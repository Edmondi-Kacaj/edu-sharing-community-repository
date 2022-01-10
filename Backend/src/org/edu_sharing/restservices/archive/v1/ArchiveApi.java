package org.edu_sharing.restservices.archive.v1;

import java.util.ArrayList;
import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.OPTIONS;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;

import org.apache.log4j.Logger;
import org.edu_sharing.restservices.ApiService;
import org.edu_sharing.restservices.ArchiveDao;
import org.edu_sharing.restservices.DAOMissingException;
import org.edu_sharing.restservices.DAOSecurityException;
import org.edu_sharing.restservices.DAOValidationException;
import org.edu_sharing.restservices.NodeDao;
import org.edu_sharing.restservices.RepositoryDao;
import org.edu_sharing.restservices.archive.v1.model.RestoreResults;
import org.edu_sharing.restservices.shared.ErrorResponse;
import org.edu_sharing.restservices.shared.Filter;
import org.edu_sharing.restservices.shared.Node;
import org.edu_sharing.restservices.shared.NodeRef;
import org.edu_sharing.restservices.shared.NodeSearch;
import org.edu_sharing.restservices.shared.Pagination;
import org.edu_sharing.restservices.shared.SearchResult;

import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

@Path("/archive/v1")
@Tag(name= "ARCHIVE v1" )
@ApiService(value = "ARCHIVE", major = 1, minor = 0)
public class ArchiveApi {

	
	/**
	 * 	GET		archive/v1/search
		GET		archive/v1/search/username
		PUT     archive/v1/restore/nodeid/targetnodeid
		DELETE  archive/v1/purge/nodeid
	 */
	
	private static Logger logger = Logger.getLogger(ArchiveApi.class);
	
	@GET
	@Path("/search/{repository}/{pattern}")
	
	@Operation(summary = "Searches for archive nodes.", description = "Searches for archive nodes.")
	
	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description="OK.", content = @Content(schema = @Schema(implementation = SearchResult.class))),
	        @ApiResponse(responseCode="400", description="Preconditions are not present.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="401", description="Authorization failed.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="403", description="Session user has insufficient rights to perform this operation.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="404", description="Ressources are not found.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))), 
	        @ApiResponse(responseCode="500", description="Fatal error occured.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))) 
	    })
	
	public Response search(@Parameter(description = "ID of repository (or \"-home-\" for home repository)", required = true, schema = @Schema(defaultValue="-home-")) @PathParam("repository") String repository,
			@Parameter(description = "search pattern", required = true) @PathParam("pattern") String pattern,
			@Parameter(description = "maximum items per page", schema = @Schema(defaultValue="10")) @QueryParam("maxItems") Integer maxItems,
		    @Parameter(description = "skip a number of items", schema = @Schema(defaultValue="0")) @QueryParam("skipCount") Integer skipCount,
		    @Parameter(description = "sort properties") @QueryParam("sortProperties") List<String> sortProperties,
		    @Parameter(description = "sort ascending") @QueryParam("sortAscending") List<Boolean> sortAscending,
		    @Parameter(description = "property filter for result nodes (or \"-all-\" for all properties)") @QueryParam("propertyFilter") List<String> propertyFilter,
			@Context HttpServletRequest req){
			
		return search(repository,pattern,null,maxItems,skipCount,sortProperties,sortAscending,new Filter(propertyFilter));
		
	}
	
	@OPTIONS    
	@Path("/search/{repository}/{pattern}")
    @Hidden

	public Response options() {
		
		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}
	
	@GET
	@Path("/search/{repository}/{pattern}/{person}")
	
	@Operation(summary = "Searches for archive nodes.", description = "Searches for archive nodes.")
	
	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description="OK.", content = @Content(schema = @Schema(implementation = SearchResult.class))),
	        @ApiResponse(responseCode="400", description="Preconditions are not present.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="401", description="Authorization failed.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="403", description="Session user has insufficient rights to perform this operation.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="404", description="Ressources are not found.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))), 
	        @ApiResponse(responseCode="500", description="Fatal error occured.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))) 
	    })
	
	public Response search(@Parameter(description = "ID of repository (or \"-home-\" for home repository)", required = true, schema = @Schema(defaultValue="-home-")) @PathParam("repository") String repository,
			@Parameter(description = "search pattern", required = true) @PathParam("pattern") String pattern,
			@Parameter(description = "person", required = true, schema = @Schema(defaultValue="-me-")) @PathParam("person") String person,
			@Parameter(description = "maximum items per page", schema = @Schema(defaultValue="10")) @QueryParam("maxItems") Integer maxItems,
		    @Parameter(description = "skip a number of items", schema = @Schema(defaultValue="0")) @QueryParam("skipCount") Integer skipCount,
		    @Parameter(description = "sort properties") @QueryParam("sortProperties") List<String> sortProperties,
		    @Parameter(description = "sort ascending") @QueryParam("sortAscending") List<Boolean> sortAscending,
		    @Parameter(description = "property filter for result nodes (or \"-all-\" for all properties)") @QueryParam("propertyFilter") List<String> propertyFilter,
			@Context HttpServletRequest req){
		
		return search(repository, pattern, person, maxItems, skipCount,sortProperties,sortAscending, new Filter(propertyFilter));
	}
	
	@OPTIONS    
	@Path("/search/{repository}/{pattern}/{person}")
    @Hidden

	public Response options1() {
		
		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}
	
	
	private Response search(String repository,
			String pattern, 
			String user,
			Integer maxItems,
		    Integer skipCount,
		    List<String> sortProperties,
		    List<Boolean> sortAscending, 
		    Filter filter){
		try {
			RepositoryDao repoDao = RepositoryDao.getRepository(repository);
			NodeSearch search = (user == null) ? 
					ArchiveDao.search(repoDao, pattern, skipCount, maxItems, sortProperties, sortAscending) : 
						ArchiveDao.search(repoDao, pattern,user, skipCount, maxItems, sortProperties, sortAscending);
			
			List<Node> data = new ArrayList<Node>();
	    	for (NodeRef ref : search.getResult()) {
	    		
	    		if(ref.isArchived()){
	    			data.add(NodeDao.getNode(repoDao, NodeDao.archiveStoreProtocol,NodeDao.archiveStoreId, ref.getId(), filter).asNode());
	    		}else{
	    			data.add(NodeDao.getNode(repoDao, ref.getId(),filter).asNode());
	    		}
	    	}
			
			Pagination pagination = new Pagination();
	    	pagination.setFrom(search.getSkip());
	    	pagination.setCount(data.size());
	    	pagination.setTotal(search.getCount());
	    	
	    	
	    	SearchResult<Node> response = new SearchResult<>();
	    	response.setNodes(data);
	    	response.setPagination(pagination);	    	
	    	response.setFacettes(search.getFacettes());
	    	
	    	return Response.status(Response.Status.OK).entity(response).build();
	    	
		} catch (Throwable t) {
    		return ErrorResponse.createResponse(t);
    	}
	}
	
	
	@DELETE
	@Path("/purge/{repository}")
	
	@Operation(summary = "Searches for archive nodes.", description = "Searches for archive nodes.")
	
	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description="OK.", content = @Content(schema = @Schema(implementation = String.class))),
	        @ApiResponse(responseCode="400", description="Preconditions are not present.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="401", description="Authorization failed.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="403", description="Session user has insufficient rights to perform this operation.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="404", description="Ressources are not found.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))), 
	        @ApiResponse(responseCode="500", description="Fatal error occured.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))) 
	    })
	
	public Response purge(@Parameter(description = "ID of repository (or \"-home-\" for home repository)", required = true, schema = @Schema(defaultValue="-home-")) @PathParam("repository") String repository,
			@Parameter(description = "archived node", required = true) @QueryParam("archivedNodeIds")  List<String> archivedNodeIds,
			@Context HttpServletRequest req){
		
		try {
			RepositoryDao repoDao = RepositoryDao.getRepository(repository);
			ArchiveDao.purge(repoDao, archivedNodeIds);
			return Response.status(Response.Status.OK).build();
		} catch (Throwable t) {
    		return ErrorResponse.createResponse(t);
    	}
	}
	
	@OPTIONS    
	@Path("/purge/{repository}/{archivedNodeId}")
    @Hidden

	public Response options2() {
		
		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, DELETE").build();
	}
	
	@POST
	@Path("/restore/{repository}")
	
	@Operation(summary = "restore archived nodes.", description = "restores archived nodes. restoreStatus can have the following values: FALLBACK_PARENT_NOT_EXISTS, FALLBACK_PARENT_NO_PERMISSION, DUPLICATENAME, FINE")
	
	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description="OK.", content = @Content(schema = @Schema(implementation = RestoreResults.class))),
	        @ApiResponse(responseCode="400", description="Preconditions are not present.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="401", description="Authorization failed.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="403", description="Session user has insufficient rights to perform this operation.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),        
	        @ApiResponse(responseCode="404", description="Ressources are not found.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))), 
	        @ApiResponse(responseCode="500", description="Fatal error occured.", content = @Content(schema = @Schema(implementation = ErrorResponse.class))) 
	    })
	
	public Response restore(@Parameter(description = "ID of repository (or \"-home-\" for home repository)", required = true, schema = @Schema(defaultValue="-home-")) @PathParam("repository") String repository,
			@Parameter(description = "archived nodes", required = true) @QueryParam("archivedNodeIds") List<String> archivedNodeIds,
			@Parameter(description = "to target", required = false) @QueryParam("target") String target,
			@Context HttpServletRequest req){
		
		try {
			RepositoryDao repoDao = RepositoryDao.getRepository(repository);
			
			RestoreResults response = new RestoreResults();
			response.setResults(ArchiveDao.restore(repoDao, archivedNodeIds, target));
			return Response.status(Response.Status.OK).entity(response).build();
		} catch (Throwable t) {
    		return ErrorResponse.createResponse(t);
    	}
	}
	
	@OPTIONS    
	@Path("/restore/{repository}/{archivedNodeId}/{target}")
    @Hidden

	public Response options3() {
		
		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, POST").build();
	}
	
}
