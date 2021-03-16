package org.edu_sharing.service.nodeservice;

import org.alfresco.model.ContentModel;
import org.alfresco.repo.security.permissions.PermissionReference;
import org.alfresco.repo.security.permissions.impl.PermissionReferenceImpl;
import org.alfresco.repo.security.permissions.impl.model.PermissionModel;
import org.alfresco.service.ServiceRegistry;
import org.alfresco.service.cmr.repository.NodeRef;
import org.alfresco.service.cmr.repository.StoreRef;
import org.alfresco.service.cmr.security.AccessPermission;
import org.alfresco.service.cmr.security.AccessStatus;
import org.alfresco.service.namespace.QName;
import org.apache.commons.io.IOUtils;
import org.apache.http.HttpHost;
import org.apache.log4j.Logger;
import org.edu_sharing.alfrescocontext.gate.AlfAppContextGate;
import org.edu_sharing.alfresco.lightbend.LightbendConfigLoader;
import org.edu_sharing.metadataset.v2.MetadataReaderV2;
import org.edu_sharing.metadataset.v2.QueryUtils;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.jobs.helper.NodeRunner;
import org.edu_sharing.repository.server.jobs.quartz.AbstractJob;
import org.edu_sharing.repository.server.jobs.quartz.OAIConst;
import org.edu_sharing.repository.server.jobs.quartz.UpdateFrontpageCacheJob;
import org.edu_sharing.service.admin.AdminServiceFactory;
import org.edu_sharing.service.admin.RepositoryConfigFactory;
import org.edu_sharing.service.admin.model.RepositoryConfig;
import org.edu_sharing.service.collection.CollectionServiceFactory;
import org.edu_sharing.service.permission.PermissionService;
import org.edu_sharing.service.permission.PermissionServiceFactory;
import org.edu_sharing.service.rating.AccumulatedRatings;
import org.edu_sharing.service.rating.RatingService;
import org.edu_sharing.service.rating.RatingServiceFactory;
import org.edu_sharing.service.search.SearchService;
import org.edu_sharing.service.search.SearchServiceElastic;
import org.edu_sharing.service.search.SearchServiceFactory;
import org.edu_sharing.service.search.model.SortDefinition;
import org.edu_sharing.service.stream.StreamServiceHelper;
import org.edu_sharing.service.toolpermission.ToolPermissionServiceFactory;
import org.edu_sharing.service.tracking.TrackingService;
import org.edu_sharing.service.tracking.TrackingServiceFactory;
import org.edu_sharing.service.tracking.model.StatisticEntry;
import org.elasticsearch.action.admin.indices.create.CreateIndexRequest;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestClientBuilder;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.xcontent.XContentBuilder;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.script.Script;
import org.elasticsearch.script.ScriptType;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.*;
import org.springframework.context.ApplicationContext;

import java.io.IOException;
import java.io.InputStream;
import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

import static org.elasticsearch.common.xcontent.XContentFactory.jsonBuilder;

public class NodeFrontpage {
    private Logger logger= Logger.getLogger(NodeFrontpage.class);
    private static final String INDEX_NAME = "frontpage_cache";
    private static final String TYPE_NAME = "_doc";
    private SearchService searchService= SearchServiceFactory.getLocalService();
    private NodeService nodeService=NodeServiceFactory.getLocalService();
    private PermissionService permissionService= PermissionServiceFactory.getLocalService();
    private RestHighLevelClient client;
    private HashMap<String, Date> APPLY_DATES;

    SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");

    public NodeFrontpage(){
        APPLY_DATES=new HashMap<>();
        Calendar calendar = Calendar.getInstance();
        calendar.add(Calendar.DATE, -30);
        APPLY_DATES.put("days_30",calendar.getTime());
        calendar = Calendar.getInstance();
        calendar.add(Calendar.DATE, -100);
        APPLY_DATES.put("days_100",calendar.getTime());
        // null means of all time
        APPLY_DATES.put("all",null);
    }
    public void buildCache(AbstractJob job) {
        try {
            initElastic();
            resetElastic();

            NodeRunner runner=new NodeRunner();
            runner.setRunAsSystem(true);
            runner.setTypes(Collections.singletonList(CCConstants.CCM_TYPE_IO));
            runner.setThreaded(true);
            runner.setInvalidateCache(false);
            runner.setTask((ref)->{
                try {
                    if (job.isInterrupted())
                        return;
                    // dummy task, only for test
                    /*AuthenticationUtil.runAsSystem(()->{
                        RatingServiceFactory.getLocalService().addOrUpdateRating(ref.getId(), (double) Math.round(Math.random()*4 + 1),"test");
                        TrackingServiceFactory.getTrackingService().trackActivityOnNode(ref,null, TrackingService.EventType.VIEW_MATERIAL);
                        TrackingServiceFactory.getTrackingService().trackActivityOnNode(ref,null, TrackingService.EventType.VIEW_MATERIAL_EMBEDDED);
                        TrackingServiceFactory.getTrackingService().trackActivityOnNode(ref,null, TrackingService.EventType.DOWNLOAD_MATERIAL);
                        return null;
                    });*/

                    String storeProt = ref.getStoreRef().getProtocol();
                    String storeId = ref.getStoreRef().getIdentifier();
                    if(nodeService.hasAspect(storeProt, storeId, ref.getId(), CCConstants.CCM_ASPECT_COLLECTION_IO_REFERENCE)){
                        String original = nodeService.getProperty(ref.getStoreRef().getProtocol(), storeProt, storeId, CCConstants.CCM_PROP_IO_ORIGINAL);
                        if(original == null || !nodeService.exists(storeProt, storeId,
                                ref.getId())){
                            logger.warn("leave out collection ref object cause original does not exist:" + ref +" orig:"+original);
                            return;
                        }
                    }

                    XContentBuilder builder = jsonBuilder().startObject();
                    addAuthorities(ref, builder);
                    addNodeMetadata(ref, builder);
                    addRatings(ref, builder);
                    addTracking(ref, builder);

                    builder.endObject();

                    IndexRequest indexRequest = new IndexRequest();
                    indexRequest.index(INDEX_NAME);
                    indexRequest.type(TYPE_NAME);
                    indexRequest.id(ref.getId());

                    indexRequest.source(builder);
                    IndexResponse result = client.index(indexRequest, RequestOptions.DEFAULT);
                    String id = result.getId();
                    logger.debug("added node cache for " + ref.getId() + " to elastic");
                }
                catch(Throwable t){
                    logger.warn(t.getMessage(),t);
                }
            });
            int size=runner.run();
            logger.info("Built up elastic frontpage cache for "+size+" nodes");
        } catch (Throwable e) {
            logger.warn(e.getMessage(),e);
        }
    }

    private void addAuthorities(NodeRef ref, XContentBuilder builder) throws IOException {
        ApplicationContext applicationContext = AlfAppContextGate.getApplicationContext();
        ServiceRegistry serviceRegistry = (ServiceRegistry) applicationContext
                .getBean(ServiceRegistry.SERVICE_REGISTRY);
        Set<AccessPermission> permissions = serviceRegistry.getPermissionService().getAllSetPermissions(ref);
        PermissionModel permissionModel= (PermissionModel) applicationContext.getBean("permissionsModelDAO");
        builder.startArray("authorities");
        permissions.stream().
                filter((permission)->{
                    if(!permission.getAccessStatus().equals(AccessStatus.ALLOWED))
                        return false;

                    try {
                        // Get the subset of all permissions for the particular permission
                        Set<PermissionReference> subPermissions = permissionModel.getGranteePermissions(PermissionReferenceImpl.getPermissionReference(QName.createQName(CCConstants.NAMESPACE_CM, "content"), permission.getPermission()));
                        //filter if this permission includes the Read Permission
                        return subPermissions.stream().anyMatch((p) -> p.getName().equals(org.alfresco.service.cmr.security.PermissionService.READ));
                    }catch(Throwable t){
                        // unknown permission, ignore for now
                        return false;
                    }
                }).
                map(AccessPermission::getAuthority).
                collect(Collectors.toSet()).
                forEach((authority)->{
                    try {
                        builder.value(authority);
                    } catch (IOException e) {}
                });
        // add the creator / owner as well
        builder.value(serviceRegistry.getNodeService().getProperty(ref, ContentModel.PROP_CREATOR));
        builder.endArray();
    }

    private void addTracking(NodeRef ref, XContentBuilder builder) throws IOException {
        TrackingService trackingService = TrackingServiceFactory.getTrackingService();
        builder.startObject("actions");
        for(Map.Entry<String, Date> date : APPLY_DATES.entrySet()) {
            try {
                StatisticEntry entry = trackingService.getSingleNodeData(ref, date.getValue(), null);
                builder.startObject(date.getKey());
                for(Map.Entry<TrackingService.EventType, Integer> count : entry.getCounts().entrySet()){
                    builder.field(count.getKey().name(),count.getValue());
                }
                builder.endObject();
            } catch (Throwable throwable) {
                throwable.printStackTrace();
            }
        }
        builder.endObject();
    }
    private void addNodeMetadata(NodeRef ref, XContentBuilder builder){
        try {
            builder.field("type",CCConstants.getValidLocalName(NodeServiceHelper.getType(ref)));
            builder.startObject("properties");
            for(Map.Entry<QName, Serializable> prop : NodeServiceHelper.getPropertiesNative(ref).entrySet()){
                Serializable val = prop.getValue();
                if(val instanceof org.alfresco.repo.domain.node.ContentDataWithId){
                    continue;
                }
                String field =CCConstants.getValidLocalName(prop.getKey().toString());
                if(field != null) {
                    if(CCConstants.CCM_PROP_IO_REPLICATIONSOURCETIMESTAMP.equals(prop.getKey().toString())){
                       try {
                           val = sdf.parse((String) val);
                       }catch(ParseException | NumberFormatException e){
                           logger.error(ref+ "error while parsing replicationsourcetimestamp:" + val);
                           val = null;
                       }
                    }
                    if(val != null) {
                        builder.field(field, val);
                    }
                }else{
                    logger.error("no valid local name for: " + prop.getKey());
                }
            }
            builder.endObject();
            builder.startArray("aspects");
            for(String aspects : NodeServiceHelper.getAspects(ref)){
                builder.value(CCConstants.getValidLocalName(aspects));
            }
            builder.endArray();
        } catch (Throwable t) {
            logger.info(t.getMessage(),t);
        }
    }


    private void addRatings(NodeRef ref, XContentBuilder builder) throws IOException {
        RatingService ratingService = RatingServiceFactory.getLocalService();
        builder.startObject("ratings");
        for(Map.Entry<String, Date> date : APPLY_DATES.entrySet()) {
            builder.startObject(date.getKey());
            AccumulatedRatings rating = ratingService.getAccumulatedRatings(ref.getId(), date.getValue());
            builder.field("overall",rating.getOverall().getRating());
            if(rating.getAffiliation()!=null) {
                builder.startObject("affiliation");
                for (Map.Entry<String, AccumulatedRatings.RatingData> affiliation : rating.getAffiliation().entrySet()) {
                    builder.field(affiliation.getKey(), affiliation.getValue().getRating());
                }
                builder.endObject();
            }
            builder.endObject();
        }
        builder.endObject();
    }
    private void resetElastic(){
        try {
            client.indices().delete(new DeleteIndexRequest(INDEX_NAME),RequestOptions.DEFAULT);
        }catch(Exception e){
        }
        initElastic();
    }
    private void initElastic() {
        RestClientBuilder restClient = RestClient.builder(SearchServiceElastic.getConfiguredHosts());
        client = new RestHighLevelClient(restClient);
        try {
            if(!client.ping(RequestOptions.DEFAULT)){
                throw new Exception();
            }
        } catch (Exception e) {
            throw new RuntimeException("No Elasticsearch instance was found at "+SearchServiceElastic.getConfiguredHosts()[0]);
        }
        try {
            CreateIndexRequest  indexRequest = new CreateIndexRequest(INDEX_NAME);
            /*
            XContentBuilder builder = jsonBuilder().
                    startObject().
                    startObject(TYPE_NAME).
                    startObject("ratings");
            for(String label : APPLY_DATES.keySet()){
                builder.startObject(label).field("overall", "double").endObject();
            }
            builder.endObject().
                    endObject().
                    endObject();
            indexRequest.mapping(TYPE_NAME, builder);
            */

            client.indices().create(indexRequest,RequestOptions.DEFAULT);
        } catch (Exception e) {
            logger.info("Error while creating the frontpage index (ignore): "+e.getMessage());
        }
    }

    public Collection<NodeRef> getNodesForCurrentUserAndConfig2() throws Throwable {
        RepositoryConfig.Frontpage config = RepositoryConfigFactory.getConfig().frontpage;
        if(config.mode.equals(RepositoryConfig.Frontpage.Mode.collection)){
            if(config.collection==null){
                throw new RuntimeException("Frontpage mode "+RepositoryConfig.Frontpage.Mode.collection+" requires a collection id to be defined");
            }
            // only return io's
            SortDefinition sortDefinition=new SortDefinition();
            sortDefinition.addSortDefinitionEntry(
                    new SortDefinition.SortDefinitionEntry(CCConstants.getValidLocalName(CCConstants.CCM_PROP_COLLECTION_ORDERED_POSITION),true),0);
            return CollectionServiceFactory.getLocalService().getChildren(config.collection, null,sortDefinition, Collections.singletonList("files"));
        }
        initElastic();
        //@TODO read and apply config
        BoolQueryBuilder query = QueryBuilders.boolQuery();
        BoolQueryBuilder audience = QueryBuilders.boolQuery();
        audience.minimumShouldMatch(1);
        for(String a : StreamServiceHelper.getCurrentAuthorities()) {
            audience.should(QueryBuilders.matchQuery("authorities", a));
        }
        query.must(audience);
        if(config.queries!=null && !config.queries.isEmpty()) {
            // filter all queries with matching toolpermissions, than concat them via "must"
            config.queries.stream().filter((q)->{
                if(q.condition.type.equals(RepositoryConfig.Condition.Type.TOOLPERMISSION)){
                    // should return true if query is launching
                    // so toolpermission == true && negate ? false : true -> toolpermission!=negate
                    return ToolPermissionServiceFactory.getInstance().hasToolPermission(q.condition.value)!=q.condition.negate;
                }
                return false;
            }).forEach((q)-> {
             query.must(QueryBuilders.wrapperQuery(QueryUtils.replaceCommonQueryParams(q.query,QueryUtils.replacerFromSyntax(MetadataReaderV2.QUERY_SYNTAX_DSL))));
            });
        }
        SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
        searchSourceBuilder.query(query);
        if(config.mode.equals(RepositoryConfig.Frontpage.Mode.rating)){
            searchSourceBuilder.sort("ratings."+config.timespan.name()+".overall", SortOrder.DESC);
        }
        else if(config.mode.equals(RepositoryConfig.Frontpage.Mode.downloads)){
            searchSourceBuilder.sort("actions."+config.timespan.name()+"."+ TrackingService.EventType.DOWNLOAD_MATERIAL.name(), SortOrder.DESC);
        }
        else{
            searchSourceBuilder.sort("actions."+config.timespan.name()+"."+ TrackingService.EventType.VIEW_MATERIAL.name(), SortOrder.DESC);
        }
        searchSourceBuilder.size(config.totalCount);
        searchSourceBuilder.from(0);
        SearchRequest searchRequest = new SearchRequest().source(searchSourceBuilder);
        searchRequest.indices(INDEX_NAME);
        SearchResponse searchResult = client.search(searchRequest,RequestOptions.DEFAULT);
        List<NodeRef> result=new ArrayList<>();
        for(SearchHit hit : searchResult.getHits().getHits()){
            if(permissionService.hasPermission(StoreRef.PROTOCOL_WORKSPACE,StoreRef.STORE_REF_WORKSPACE_SPACESSTORE.getIdentifier(),hit.getId(),CCConstants.PERMISSION_READ)){
                result.add(new NodeRef(StoreRef.STORE_REF_WORKSPACE_SPACESSTORE,hit.getId()));
            }
        }
        if(config.displayCount<config.totalCount) {
            Set<NodeRef> randoms = new HashSet<>();
            // grab a random count of elements (equals displayCount) of the whole array
            while (randoms.size() < config.displayCount && randoms.size()<result.size()) {
                randoms.add(result.get(new Random().nextInt(result.size())));
            }
            return randoms;
        }
        return result;
    }

    public Collection<NodeRef> getNodesForCurrentUserAndConfig() throws Throwable {
        //collection: erstmal so lassen
        RepositoryConfig.Frontpage config = RepositoryConfigFactory.getConfig().frontpage;
        if(config.mode.equals(RepositoryConfig.Frontpage.Mode.collection)){
            if(config.collection==null){
                throw new RuntimeException("Frontpage mode "+RepositoryConfig.Frontpage.Mode.collection+" requires a collection id to be defined");
            }
            // only return io's
            SortDefinition sortDefinition=new SortDefinition();
            sortDefinition.addSortDefinitionEntry(
                    new SortDefinition.SortDefinitionEntry(CCConstants.getValidLocalName(CCConstants.CCM_PROP_COLLECTION_ORDERED_POSITION),true),0);
            return CollectionServiceFactory.getLocalService().getChildren(config.collection, null,sortDefinition, Collections.singletonList("files"));
        }
        //initElastic rasuschmeißen (frontpage_cache nicht mehr benötigt)
        initElastic();
        //audience filter wie in searchV2
        BoolQueryBuilder query = QueryBuilders.boolQuery();
        query.must(SearchServiceElastic.getAuthorityQueryBuilder());
        query.must(QueryBuilders.termQuery("type","ccm:io"));
        query.must(QueryBuilders.termQuery("nodeRef.storeRef.protocol","workspace"));

        //Toolpermission check auf queries : @TODO überlegen wie der check mit elastic gehen könnte
        if(config.queries!=null && !config.queries.isEmpty()) {
            // filter all queries with matching toolpermissions, than concat them via "must"
            config.queries.stream().filter((q)->{
                if(q.condition.type.equals(RepositoryConfig.Condition.Type.TOOLPERMISSION)){
                    // should return true if query is launching
                    // so toolpermission == true && negate ? false : true -> toolpermission!=negate
                    return ToolPermissionServiceFactory.getInstance().hasToolPermission(q.condition.value)!=q.condition.negate;
                }
                return false;
            }).forEach((q)-> {
                //die config queries in den extensions überprüfen und ggf auf hautp index anpassen
                query.must(QueryBuilders.wrapperQuery(QueryUtils.replaceCommonQueryParams(q.query,QueryUtils.replacerFromSyntax(MetadataReaderV2.QUERY_SYNTAX_DSL))));
            });
        }


        //InputStream is = NodeFrontpage.class.getClassLoader().getResourceAsStream("frontpage-ratings.properties");
        InputStream is = NodeFrontpage.class.getClassLoader().getResource("frontpage-ratings.properties").openStream();
        String sortingScript = IOUtils.toString(is, StandardCharsets.UTF_8.name());
        logger.info("loaded script:"+sortingScript);

        SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
        searchSourceBuilder.query(query);

        Map<String,Object> params = new HashMap<>();
        params.put("mode",config.mode);
        if(RepositoryConfig.Frontpage.Timespan.days_30.equals(config.timespan)){
            params.put("history",1);
        }else if(RepositoryConfig.Frontpage.Timespan.days_100.equals(config.timespan)){
            params.put("history",3);
        }
        Script script = new Script(Script.DEFAULT_SCRIPT_TYPE, "painless", sortingScript,Collections.emptyMap(),params);
        ScriptSortBuilder sb = SortBuilders.scriptSort(script, ScriptSortBuilder.ScriptSortType.NUMBER).order(SortOrder.DESC);
        sb.sortMode(SortMode.MAX);
        searchSourceBuilder.sort(sb);


        //wie gehabt
        searchSourceBuilder.size(config.totalCount);
        searchSourceBuilder.from(0);
        SearchRequest searchRequest = new SearchRequest().source(searchSourceBuilder);
        searchRequest.indices("workspace");
        SearchResponse searchResult = client.search(searchRequest,RequestOptions.DEFAULT);
        List<NodeRef> result=new ArrayList<>();
        for(SearchHit hit : searchResult.getHits().getHits()){
            logger.info("score:"+hit.getScore() +" id:"+hit.getId() + " "+ ((Map)hit.getSourceAsMap().get("properties")).get("cm:name"));
            if(permissionService.hasPermission(StoreRef.PROTOCOL_WORKSPACE,StoreRef.STORE_REF_WORKSPACE_SPACESSTORE.getIdentifier(),hit.getId(),CCConstants.PERMISSION_READ)){
                Map nodeRef = (Map) hit.getSourceAsMap().get("nodeRef");
                String nodeId = (String) nodeRef.get("id");
                result.add(new NodeRef(StoreRef.STORE_REF_WORKSPACE_SPACESSTORE,nodeId));
            }
        }
        if(config.displayCount<config.totalCount) {
            Set<NodeRef> randoms = new HashSet<>();
            // grab a random count of elements (equals displayCount) of the whole array
            while (randoms.size() < config.displayCount && randoms.size()<result.size()) {
                randoms.add(result.get(new Random().nextInt(result.size())));
            }
            return randoms;
        }
        return result;

    }
}
