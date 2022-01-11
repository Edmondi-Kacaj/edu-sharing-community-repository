package org.edu_sharing.restservices;

import java.util.ArrayList;
import java.util.List;

import org.edu_sharing.metadataset.v2.*;
import org.edu_sharing.metadataset.v2.tools.MetadataHelper;
import org.edu_sharing.metadataset.v2.tools.MetadataSearchHelper;
import org.edu_sharing.repository.server.RepoFactory;
import org.edu_sharing.restservices.mds.v1.model.*;
import org.edu_sharing.restservices.shared.MdsQueryCriteria;
import org.edu_sharing.restservices.shared.Mds;
import org.edu_sharing.service.search.Suggestion;

public class MdsDao {

	public static final String DEFAULT = "-default-";

	public static List<MetadataSetInfo> getAllMdsDesc(RepositoryDao repoDao) throws Exception {
		return RepoFactory.getMetadataSetsForRepository(repoDao.getId());
	}
	
	public Suggestions getSuggestions(String queryId,String parameter,String value, List<MdsQueryCriteria> criterias) throws DAOException{
		Suggestions result = new Suggestions();
		ArrayList<Suggestions.Suggestion> suggestionsResult = new ArrayList<>();
		result.setValues(suggestionsResult);
		try{
			List<? extends Suggestion>  suggestions =
					MetadataSearchHelper.getSuggestions(this.repoDao.getId(), mds, queryId, parameter, value, criterias);

			for(Suggestion suggest : suggestions){
				Suggestions.Suggestion suggestion = new Suggestions.Suggestion();
				suggestion.setDisplayString(suggest.getDisplayString());
				//suggestion.setReplacementString(suggest.getReplacementString());
				suggestion.setKey(suggest.getKey());
				suggestionsResult.add(suggestion);
			}
			
		}catch(Exception e){
			throw DAOException.mapping(e);
		}
		return result;
	}
	
	public static MdsDao getMds(RepositoryDao repoDao, String mdsId) throws DAOException {

		try {
			
			MetadataSet mds=MetadataHelper.getMetadataset(repoDao.getApplicationInfo(),mdsId);
			
			if (mds == null) {
				throw new DAOMissingException(new IllegalArgumentException(mdsId));
			}
			
			return new MdsDao(repoDao, mds);
			
		} catch (Throwable t) {
			throw DAOException.mapping(t);
		}
		
	}

	private final RepositoryDao repoDao;	
	private final MetadataSet mds;
	
	private MdsDao(RepositoryDao repoDao, MetadataSet mds) {
		this.repoDao = repoDao;		
		this.mds = mds;		
	}

	public Mds asMds() {
		
    	Mds data = new Mds();
    	
    	data.setName(mds.getName());
    	data.setCreate(mds.getCreate()!=null ? new Mds.Create(mds.getCreate()) : null);
    	data.setWidgets(getWidgets());
    	data.setViews(getViews());
    	data.setGroups(getGroups());
    	data.setLists(getLists());
    	data.setSorts(getSorts());

    	return data; 
	}

	private List<MdsWidget> getWidgets() {
		List<MdsWidget> result = new ArrayList<MdsWidget>();
		for (MetadataWidget type : this.mds.getWidgets()) {
			result.add(new MdsWidget(type));
		}
		return result;		
	}
	
	private List<MdsView> getViews() {
		List<MdsView> result = new ArrayList<MdsView>();
		for (MetadataTemplate type : this.mds.getTemplates()) {
			result.add(new MdsView(type));
		}
		return result;		
	}
	
	private List<MdsGroup> getGroups() {
		List<MdsGroup> result = new ArrayList<MdsGroup>();
		for (MetadataGroup type : this.mds.getGroups()) {
			result.add(new MdsGroup(type));
		}
		return result;		
	}
	
	private List<MdsList> getLists() {
		List<MdsList> result = new ArrayList<>();
		for (MetadataList type : this.mds.getLists()) {
			result.add(new MdsList(type));
		}
		return result;		
	}

	private List<MdsSort> getSorts() {
		List<MdsSort> result = new ArrayList<>();
		for (MetadataSort type : this.mds.getSorts()) {
			result.add(new MdsSort(type));
		}
		return result;
	}
	
	public MetadataSet getMds() {
		return mds;
	}
	
}
