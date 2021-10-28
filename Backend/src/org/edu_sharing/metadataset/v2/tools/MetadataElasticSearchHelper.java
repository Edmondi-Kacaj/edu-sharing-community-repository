package org.edu_sharing.metadataset.v2.tools;

import com.sun.star.lang.IllegalArgumentException;
import org.edu_sharing.metadataset.v2.*;
import org.edu_sharing.repository.server.AuthenticationToolAPI;
import org.edu_sharing.restservices.mds.v1.model.MdsWidget;
import org.edu_sharing.service.search.model.SearchToken;
import org.elasticsearch.index.query.*;
import org.elasticsearch.search.aggregations.AggregationBuilder;
import org.elasticsearch.search.aggregations.AggregationBuilders;

import java.security.InvalidParameterException;
import java.util.*;

public class MetadataElasticSearchHelper extends MetadataSearchHelper {

    public static QueryBuilder getElasticSearchQuery(MetadataQueries queries,MetadataQuery query, Map<String,String[]> parameters) throws IllegalArgumentException {
        return getElasticSearchQuery(queries,query,parameters,true);
    }

    public static QueryBuilder getElasticSearchQuery(MetadataQueries queries,MetadataQuery query, Map<String,String[]> parameters, Boolean asFilter) throws IllegalArgumentException {

        /**
         * @TODO basequery
         * quickfix: take the basequery of the query instead of the global basequery,
         * cause collection request needs solr basequery
         */
        String baseQuery = query.getBasequery().get(null);
        BoolQueryBuilder result = QueryBuilders.boolQuery();

        if(asFilter == null || (asFilter.booleanValue() == query.getBasequeryAsFilter())){
            WrapperQueryBuilder baseQueryBuilder = QueryBuilders.wrapperQuery(baseQuery);
            result.must(baseQueryBuilder);
        }

        for (String name : parameters.keySet()) {
            MetadataQueryParameter parameter = query.findParameterByName(name);
            if (parameter == null)
                throw new IllegalArgumentException("Could not find parameter " + name + " in the query " + query.getId());

            String[] values = parameters.get(parameter.getName());
            /**
             * @TODO MetadataSearchHelper check if ignoreable is needed
             */
            if ((values == null || values.length == 0)) {
                //if(parameter.getIgnorable()==0)
                continue;
            }

            if(asFilter != null && parameter.isAsFilter() != asFilter.booleanValue()){
                continue;
            }

            QueryBuilder queryBuilderParam = null;
            if(query.isApplyBasequery()){
                if(queries.findBasequery(parameters.keySet())!=null &&
                        !queries.findBasequery(parameters.keySet()).isEmpty()) {
                    result.must(QueryBuilders.wrapperQuery(queries.findBasequery(parameters.keySet())));
                }
                result = applyCondition(queries, result);
            }
            result = applyCondition(query, result);
            if (parameter.isMultiple()) {

                String multipleJoin = parameter.getMultiplejoin();
                BoolQueryBuilder boolQueryBuilder = QueryBuilders.boolQuery();
                if (multipleJoin.equals("AND")) {

                    for(String value : values){
                        boolQueryBuilder = boolQueryBuilder.must(QueryBuilders.wrapperQuery(replaceCommonQueryVariables(getStatmentForValue(parameter,value))));
                    }
                } else {
                    for(String value : values){
                        boolQueryBuilder = boolQueryBuilder.should(QueryBuilders.wrapperQuery(replaceCommonQueryVariables(getStatmentForValue(parameter,value))));
                    }
                }

                queryBuilderParam = boolQueryBuilder;
            }else{
                if(values.length>1){
                    throw new InvalidParameterException("Trying to search for multiple values of a non-multivalue field "+parameter.getName());
                }

                queryBuilderParam = QueryBuilders.wrapperQuery(replaceCommonQueryVariables(getStatmentForValue(parameter,values[0])));
            }

            if(query.getJoin().equals("AND")){
                result = result.must(queryBuilderParam);
            }else{
                result = result.should(queryBuilderParam);
            }

        }
        return result;
    }

    private static BoolQueryBuilder applyCondition(MetadataQueryBase query, BoolQueryBuilder result) {
        for(MetadataQueryCondition condition : query.getConditions()){
            boolean conditionState= MetadataHelper.checkConditionTrue(condition.getCondition());
            if(conditionState && condition.getQueryTrue()!=null) {
                String conditionString = condition.getQueryTrue();
                conditionString = replaceCommonQueryVariables(conditionString);
                result.must(QueryBuilders.wrapperQuery(conditionString));
            }
            if(!conditionState && condition.getQueryFalse()!=null) {
                String conditionString =condition.getQueryFalse();
                conditionString = replaceCommonQueryVariables(conditionString);
                result.must(QueryBuilders.wrapperQuery(conditionString));
            }
        }
        return result;
    }
    private static String getStatmentForValue(MetadataQueryParameter parameter, String value) {
        if (value == null && parameter.isMandatory()) {
            throw new java.lang.IllegalArgumentException("null value for mandatory parameter " + parameter.getName() + " given, null values are not allowed if mandatory is set to true");
        }
        if (value == null)
            return "";

        // invoke any preprocessors for this value
        try {
            value = MetadataQueryPreprocessor.run(parameter, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        if (value.startsWith("\"") && value.endsWith("\"") || parameter.isExactMatching()) {
            //String statement = parameter.getStatement(value).replace("${value}", QueryParser.escape(value));
            return QueryUtils.replacerFromSyntax(parameter.getSyntax()).replaceString(
                    parameter.getStatement(value),
                    "${value}", value);
        }

        String[] words = value.split(" ");
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();
        for (String word : words) {
            //String statement = parameter.getStatement(value).replace("${value}", QueryParser.escape(word));
            String statement = QueryUtils.replacerFromSyntax(parameter.getSyntax()).replaceString(
                    parameter.getStatement(value),
                    "${value}", word);
            boolQuery = boolQuery.must(QueryBuilders.wrapperQuery(statement));

        }
        return boolQuery.toString();
    }

    public static Set<MetadataQueryParameter> getExcludeOwnFacets(MetadataQuery query, Map<String,String[]> parameters, List<String> facets){
        Set<MetadataQueryParameter> excludeOwn = new HashSet<>();
        for (String name : facets) {
            MetadataQueryParameter parameter = query.findParameterByName(name);
            if(parameter == null) continue;
            if((parameter.getMultiplejoin() != null && parameter.getMultiplejoin().equals("OR"))) excludeOwn.add(parameter);
        }
        return excludeOwn;
    }

    /**
     * returns FilterAggregations to be used in a separate call
     * @param mds
     * @param query
     * @param parameters
     * @param facets
     * @param excludeOwn
     * @param globalConditions
     * @param searchToken
     * @return
     * @throws IllegalArgumentException
     */
    public static List<AggregationBuilder> getAggregations(MetadataSetV2 mds, MetadataQuery query, Map<String,String[]> parameters, List<String> facets, Set<MetadataQueryParameter> excludeOwn, QueryBuilder globalConditions, SearchToken searchToken) throws IllegalArgumentException {
        MetadataQueries queries = mds.getQueries(MetadataReaderV2.QUERY_SYNTAX_DSL);
        List<AggregationBuilder> result = new ArrayList<>();
        String currentLocale = new AuthenticationToolAPI().getCurrentLocale();
        for (String facet : facets) {

            Map<String, String[]> tmp = new HashMap<>(parameters);
            if (excludeOwn.stream().anyMatch(mdqp -> mdqp.getName().equals(facet))) {
                tmp.remove(facet);
            }

            QueryBuilder qbFilter = getElasticSearchQuery(queries, query, tmp, true);
            QueryBuilder qbNoFilter = getElasticSearchQuery(queries, query, tmp, false);
            BoolQueryBuilder bqb = QueryBuilders.boolQuery();
            bqb = bqb.must(qbFilter).must(qbNoFilter).must(globalConditions);
            if(searchToken.getQueryString() != null && !searchToken.getQueryString().trim().isEmpty()){

                boolean isi18nProp = false;
                MetadataWidget mdw = mds.findWidget(facet);
                if(mdw != null && new MdsWidget(mdw).isHasValues()){
                    isi18nProp = true;
                }

                MultiMatchQueryBuilder mmqb = null;

                if(isi18nProp){
                    mmqb = QueryBuilders
                            .multiMatchQuery(searchToken.getQueryString(),"i18n."+currentLocale+"."+facet,"collections.i18n."+currentLocale+"."+facet);
                }else{
                    mmqb = QueryBuilders
                            .multiMatchQuery(searchToken.getQueryString(),"properties."+facet);
                }
                mmqb.type(MultiMatchQueryBuilder.Type.BOOL_PREFIX).operator(Operator.AND);
                bqb.must(mmqb);
            }

            result.add(AggregationBuilders.filter(facet, bqb).subAggregation(AggregationBuilders.terms(facet)
                    .size(searchToken.getFacetLimit())
                    .minDocCount(searchToken.getFacetsMinCount())
                    .field("properties." + facet+".keyword")));


        }

        return result;
    }
}