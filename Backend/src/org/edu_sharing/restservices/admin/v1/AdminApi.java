package org.edu_sharing.restservices.admin.v1;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.alfresco.rest.framework.core.exceptions.InvalidArgumentException;
import org.alfresco.service.cmr.repository.NodeRef;
import org.alfresco.service.cmr.repository.StoreRef;
import org.apache.log4j.Level;
import org.apache.log4j.LogManager;
import org.apache.log4j.Logger;
import org.edu_sharing.alfrescocontext.gate.AlfAppContextGate;
import org.edu_sharing.repository.client.rpc.cache.CacheCluster;
import org.edu_sharing.repository.client.rpc.cache.CacheInfo;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.jobs.quartz.JobDescription;
import org.edu_sharing.repository.server.jobs.quartz.JobInfo;
import org.edu_sharing.repository.server.tools.ApplicationInfo;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;
import org.edu_sharing.repository.server.tools.cache.PreviewCache;
import org.edu_sharing.restservices.*;
import org.edu_sharing.restservices.admin.v1.model.*;
import org.edu_sharing.restservices.shared.*;
import org.edu_sharing.service.NotAnAdminException;
import org.edu_sharing.service.admin.AdminService;
import org.edu_sharing.service.admin.AdminServiceFactory;
import org.edu_sharing.service.admin.model.GlobalGroup;
import org.edu_sharing.service.admin.model.RepositoryConfig;
import org.edu_sharing.service.admin.model.ServerUpdateInfo;
import org.edu_sharing.service.admin.model.ToolPermission;
import org.edu_sharing.service.authority.AuthorityServiceHelper;
import org.edu_sharing.service.lifecycle.PersonDeleteOptions;
import org.edu_sharing.service.lifecycle.PersonLifecycleService;
import org.edu_sharing.service.lifecycle.PersonReport;
import org.edu_sharing.service.nodeservice.NodeServiceFactory;
import org.edu_sharing.service.nodeservice.NodeServiceHelper;
import org.edu_sharing.service.search.SearchResultNodeRefElastic;
import org.edu_sharing.service.search.SearchService.ContentType;
import org.edu_sharing.service.search.SearchServiceElastic;
import org.edu_sharing.service.search.model.SearchToken;
import org.edu_sharing.service.search.model.SortDefinition;
import org.elasticsearch.common.Strings;
import org.elasticsearch.common.xcontent.ToXContent;
import org.elasticsearch.common.xcontent.XContentBuilder;
import org.elasticsearch.common.xcontent.XContentFactory;
import org.glassfish.jersey.media.multipart.FormDataParam;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import java.io.FileWriter;
import java.io.InputStream;
import java.io.Serializable;
import java.io.Writer;
import java.lang.reflect.Method;
import java.util.*;
import java.util.Map.Entry;
import java.util.stream.Collectors;

@Path("/admin/v1")
@Tag(name="ADMIN v1")
@ApiService(value = "ADMIN", major = 1, minor = 0)
@Consumes({ "application/json" })
@Produces({"application/json"})
public class AdminApi {
	static Map<String, String[]> XML_FILTER = new HashMap<>();
	static {
		XML_FILTER.put(AdminServiceFactory.HOME_APPLICATION_PROPERTIES, new String[] { "private_key", "password" });
	}

	private static Logger logger = Logger.getLogger(AdminApi.class);

	@POST
	@Path("/refreshAppInfo")

	@Operation(summary = "refresh app info", description = "Refresh the application info.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response refreshAppInfo(@Context HttpServletRequest req) {
		try {
			AdminServiceFactory.getInstance().refreshApplicationInfo();
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}
	@GET
	@Path("/toolpermissions/{authority}")

	@Operation(summary = "get all toolpermissions for an authority", description="Returns explicit (rights set for this authority) + effective (resulting rights for this authority) toolpermission")

	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Map.class))),
	        @ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
	    })
	public Response getAllToolpermissions(
			@Parameter(description = "Authority to load (user or group)",required=true) @PathParam("authority") String authority,
			@Context HttpServletRequest req){
		try {
			Map<String, ToolPermission> result = AdminServiceFactory.getInstance().getToolpermissions(authority);
	    	return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}
	@PUT
	@Path("/toolpermissions/{authority}")

	@Operation(summary = "set toolpermissions for an authority", description="If a toolpermission has status UNDEFINED, it will remove explicit permissions for the authority")

	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Map.class))),
	        @ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
	    })
	public Response setToolpermissions(
			@Parameter(description = "Authority to set (user or group)",required=true) @PathParam("authority") String authority,
			Map<String,ToolPermission.Status> permissions,
			@Context HttpServletRequest req){
		try {
			AdminServiceFactory.getInstance().setToolpermissions(authority,permissions);
	    	return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}
	@POST
	@Path("/applyTemplate")

	@Operation(summary = "apply a folder template", description = "apply a folder template.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response applyTemplate(@Context HttpServletRequest req,
			@Parameter(description = "Template Filename", required = true) @QueryParam("template") String template,
			@Parameter(description = "Group name (authority name)", required = true) @QueryParam("group") String group,
			@Parameter(description = "Folder name", required = false) @QueryParam("folder") String folder) {
		try {
			AdminServiceFactory.getInstance().applyTemplate(template, group, folder);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@POST
	@Path("/toolpermissions/add/{name}")

	@Operation(summary = "add a new toolpermissions")

	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Node.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
	})
	public Response addToolpermission(
			@Parameter(description = "Name/ID of toolpermission",required=true) @PathParam("name") String name,
			@Context HttpServletRequest req){
		try {
			String nodeId=AdminServiceFactory.getInstance().addToolpermission(name);
			NodeDao nodeDao=NodeDao.getNode(RepositoryDao.getHomeRepository(),nodeId);
			return Response.ok().entity(nodeDao.asNode()).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/refreshAppInfo")
	@Hidden

	public Response options() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, POST").build();
	}

	@GET
	@Path("/applications")

	@Operation(summary = "list applications", description = "List all registered applications.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Application[].class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getApplications(@Context HttpServletRequest req) {
		try {
			List<Application> result = new ArrayList<Application>();
			for (ApplicationInfo appInfo : ApplicationInfoList.getRepositoryInfosOrdered()) {
				if (appInfo.ishomeNode())
					continue;
				Application entry = new Application();
				entry.setId(appInfo.getAppId());
				entry.setTitle(appInfo.getAppCaption());
				entry.setWebserverUrl(appInfo.getWebServerUrl());
				entry.setContentUrl(appInfo.getContentUrl());
				entry.setClientBaseUrl(appInfo.getClientBaseUrl());
				entry.setType(appInfo.getType());
				entry.setRepositoryType(appInfo.getRepositoryType());
				entry.setSubtype(appInfo.getSubtype());
				entry.setXml(appInfo.getXml());
				entry.setFile(appInfo.getAppFile());
				if (ApplicationInfo.TYPE_RENDERSERVICE.equals(entry.getType()) && entry.getContentUrl() != null) {
					entry.setConfigUrl(appInfo.getContentUrl().replace("/application/esmain/index.php", "/admin"));
				}
				result.add(entry);
			}
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}
	@GET
	@Path("/jobs")

	@Operation(summary = "get all running jobs")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = JobInfo[].class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getJobs(@Context HttpServletRequest req) {
		try {
			return Response.ok().entity(AdminServiceFactory.getInstance().getJobs()).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@GET
	@Path("/jobs/all")

	@Operation(summary = "get all available jobs")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = JobDescription[].class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getAllJobs(@Context HttpServletRequest req) {
		try {
			return Response.ok().entity(AdminServiceFactory.getInstance().getJobDescriptions(false)).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}



	@DELETE
	@Path("/jobs/{job}")

	@Operation(summary = "cancel a running job")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response cancelJob(@Context HttpServletRequest req,
							  @PathParam("job") String name) {
		try {
			AdminServiceFactory.getInstance().cancelJob(name);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@GET
	@Path("/statistics")

	@Operation(summary = "get statistics", description = "get statistics.")

	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = AdminStatistics.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getStatistics(@Context HttpServletRequest req) {
		try {
			AdminStatistics statistics = new AdminStatistics();
			AdminService service = AdminServiceFactory.getInstance();
			statistics.setActiveSessions(service.getActiveSessions());
			List<Node> locks = new ArrayList<Node>();
			for (NodeRef lock : service.getActiveNodeLocks()) {
				locks.add(NodeDao.getNode(RepositoryDao.getRepository(RepositoryDao.HOME), lock.getId()).asNode());
			}
			statistics.setActiveLocks(locks);
			Runtime runtime = Runtime.getRuntime();
			statistics.setMaxMemory(runtime.maxMemory());
			statistics.setAllocatedMemory(runtime.totalMemory());
			statistics.setNumberOfPreviews(PreviewCache.getNumberOfPreviews());
			statistics.setPreviewCacheSize(PreviewCache.getTotalSize());
			return Response.ok().entity(statistics).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@GET
	@Path("/applications/{xml}")

	@Operation(summary = "list any xml properties (like from homeApplication.properties.xml)", description = "list any xml properties (like from homeApplication.properties.xml)")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Map.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })

	public Response getApplicationXML(@Context HttpServletRequest req,
			@Parameter(description = "Properties Filename (*.xml)", required = true) @PathParam("xml") String xml) {
		try {
			Set<Entry<Object, Object>> set = AdminServiceFactory.getInstance().getPropertiesXML(xml).entrySet();
			Map<String, String> map = new HashMap<String, String>();
			String[] filter = XML_FILTER.get(xml);
			for (Entry<Object, Object> entry : set) {
				if (filter != null && Arrays.asList(filter).contains(entry.getKey()))
					continue;

				map.put((String) entry.getKey(), (String) entry.getValue());
			}
			return Response.ok().entity(map).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@PUT
	@Path("/applications/{xml}")
	@Operation(summary = "edit any properties xml (like homeApplication.properties.xml)", description = "if the key exists, it will be overwritten. Otherwise, it will be created. You only need to transfer keys you want to edit")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response updateApplicationXML(@Context HttpServletRequest req,
			@Parameter(description = "Properties Filename (*.xml)", required = true) @PathParam("xml") String xml,
			Map<String, String> properties) {
		try {
			AdminServiceFactory.getInstance().updatePropertiesXML(xml, properties);
			return Response.ok().build();

		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@DELETE
	@Path("/applications/{id}")

	@Operation(summary = "remove an application", description = "remove the specified application.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response removeApplication(@Parameter(description = "Application id", required = true) @PathParam("id") String id,
			@Context HttpServletRequest req) {
		try {
			ApplicationInfo info = ApplicationInfoList.getRepositoryInfoById(id);
			if (info == null || info.ishomeNode())
				throw new InvalidArgumentException("Application id not found or unremovable");
			AdminServiceFactory.getInstance().removeApplication(info);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@PUT
	@Path("/applications/xml")
	@Consumes({ "multipart/form-data" })
	@Operation(summary = "register/add an application via xml file", description = "register the xml file provided.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = HashMap.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response addApplication(
			@Parameter(description = "XML file for app to register", required = true) @FormDataParam("xml") InputStream is,
			@Context HttpServletRequest req) {
		try {
			HashMap<String, String> result = AdminServiceFactory.getInstance().addApplicationFromStream(is);
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@PUT
	@Path("/applications")

	@Operation(summary = "register/add an application", description = "register the specified application.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = HashMap.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response addApplication(
			@Parameter(description = "Remote application metadata url", required = true) @QueryParam("url") String url,
			@Context HttpServletRequest req) {
		try {
			HashMap<String, String> result = AdminServiceFactory.getInstance().addApplication(url);
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/applications")
	@Hidden

	public Response options1() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, PUT").build();
	}

	@GET
	@Path("/serverUpdate/list")

	@Operation(summary = "list available update tasks", description = "list available update tasks")

	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = ServerUpdateInfo[].class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response serverUpdateList(@Context HttpServletRequest req) {
		try {
			List<ServerUpdateInfo> result = AdminServiceFactory.getInstance().getServerUpdateInfos();
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/serverUpdate/list")
	@Hidden

	public Response options2() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}

	@POST
	@Path("/serverUpdate/run/{id}")

	@Operation(summary = "Run an update tasks", description = "Run a specific update task (test or full update).")

	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = ServerUpdateInfo[].class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response serverUpdateList(
			@Parameter(description = "Id of the update task", required = true) @PathParam("id") String id,
			@Parameter(description = "Actually execute (if false, just runs in test mode)", schema = @Schema(defaultValue="false"), required = true) @QueryParam("execute") Boolean execute,
			@Context HttpServletRequest req) {
		try {
			UpdateResult result = new UpdateResult(
					AdminServiceFactory.getInstance().runUpdate(id, execute == null ? false : execute));
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/serverUpdate/run/{id}")
	@Hidden

	public Response options3() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, POST").build();
	}

	@POST
	@Path("/cache/refreshEduGroupCache")

	@Operation(summary = "Refresh the Edu Group Cache", description = "Refresh the Edu Group Cache.")

	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
	        @ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
	    })
	public Response refreshEduGroupCache(
            @Parameter(description = "keep existing", schema = @Schema(defaultValue="false")) @QueryParam("keepExisting") Boolean keepExisting,
            @Context HttpServletRequest req){
		try {
            AdminServiceFactory.getInstance().refreshEduGroupCache(keepExisting);
	    	return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/cache/refreshEduGroupCache")
	@Hidden

	public Response options4() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}

	@POST
	@Path("/cache/removeCacheEntry")

	@Operation(summary = "remove cache entry", description = "remove cache entry")

	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
	        @ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
	        @ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
	    })
	public Response removeCacheEntry(
            @Parameter(description = "cacheIndex") @QueryParam("cacheIndex") Integer cacheIndex,
            @Parameter(description = "bean") @QueryParam("bean") String bean,
            @Context HttpServletRequest req){
		try {
            AdminServiceFactory.getInstance().removeCacheEntry(cacheIndex, bean);
	    	return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@POST
	@Path("/cache/clearCache")

	@Operation(summary = "clear cache", description = "clear cache")

	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
	})
	public Response clearCache(

			@Parameter(description = "bean") @QueryParam("bean") String bean,
			@Context HttpServletRequest req){
		try {
			AdminServiceFactory.getInstance().clearCache(bean);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@GET
	@Path("/cache/cacheEntries/{id}")

	@Operation(summary = "Get entries of a cache", description = "Get entries of a cache.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Map.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getCacheEntries(@Parameter(description = "Id/bean name of the cache") @PathParam("id") String id,
								 @Context HttpServletRequest req) {
		try {
			Map<Serializable, Serializable> result = AdminServiceFactory.getInstance().getCacheEntries(id);
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}



	@GET
	@Path("/cache/cacheInfo/{id}")

	@Operation(summary = "Get information about a cache", description = "Get information about a cache.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = CacheInfo.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getCacheInfo(@Parameter(description = "Id/bean name of the cache") @PathParam("id") String id,
			@Context HttpServletRequest req) {
		try {
			CacheInfo result = AdminServiceFactory.getInstance().getCacheInfo(id);
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@GET
	@Path("/catalina")

	@Operation(summary = "Get last info from catalina out", description = "Get catalina.out log.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = String[].class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getCatalinaOut(@Context HttpServletRequest req) {
		try {
			List<String> result = AdminServiceFactory.getInstance().getCatalinaOut();
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/cacheInfo/{id}")
	@Hidden

	public Response options5() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}

	@GET
	@Path("/globalGroups")

	@Operation(summary = "Get global groups", description = "Get global groups (groups across repositories).")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Group[].class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getGlobalGroups(@Context HttpServletRequest req) {
		try {
			List<GlobalGroup> result = AdminServiceFactory.getInstance().getGlobalGroups();
			List<Group> mapped = new ArrayList<>();
			for (GlobalGroup group : result) {
				mapped.add(new Group(group));
			}
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/globalGroups")
	@Hidden

	public Response options6() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}

	@POST
	@Path("/import/collections")
	@Consumes({ "multipart/form-data" })
	@Operation(summary = "import collections via a xml file", description = "xml file must be structured as defined by the xsd standard")

	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = CollectionsResult.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response importCollections(
			@Parameter(description = "Id of the root to initialize the collection structure, or '-root-' to inflate them on the first level") @QueryParam("parent") String parent,
			@Parameter(description = "XML file to parse (or zip file containing exactly 1 xml file to parse)", required = true) @FormDataParam("xml") InputStream is,
			@Context HttpServletRequest req) {
		try {
			if (CollectionDao.ROOT.equals(parent)) {
				parent = null;
			}
			int count = AdminServiceFactory.getInstance().importCollections(parent, is);
			CollectionsResult result = new CollectionsResult();
			result.setCount(count);
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@POST
	@Path("/import/excel")
	@Consumes({ "multipart/form-data" })
	@Operation(summary = "Import excel data", description = "Import excel data.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = ExcelResult.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response importExcel(@Parameter(description = "parent", required = true) @QueryParam("parent") String parent,
								@Parameter(description = "addToCollection", required = true, schema = @Schema(defaultValue="false")) @QueryParam("addToCollection") Boolean addToCollection,
			@Parameter(description = "Excel file to import", required = true) @FormDataParam("excel") InputStream is,
			@Context HttpServletRequest req) {
		try {
			addToCollection = (addToCollection == null) ? false : addToCollection;
			int count = AdminServiceFactory.getInstance().importExcel(parent, is, addToCollection);
			ExcelResult result = new ExcelResult();
			result.setRows(count);
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@PUT
	@Path("/upload/temp/{name}")
	@Consumes({ "multipart/form-data" })
	@Operation(summary = "Upload a file", description = "Upload a file to tomcat temp directory, to use it on the server (e.g. an update)")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = UploadResult.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response uploadTemp(@Parameter(description = "filename", required = true) @PathParam("name") String name,
			@Parameter(description = "file to upload", required = true) @FormDataParam("file") InputStream is,
			@Context HttpServletRequest req) {
		try {
			String file = AdminServiceFactory.getInstance().uploadTemp(name, is);
			return Response.ok().entity(new UploadResult(file)).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@POST
	@Path("/import/oai")

	@Operation(summary = "Import oai data", description = "Import oai data.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response importOai(@Parameter(description = "base url", required = true) @QueryParam("baseUrl") String baseUrl,
			@Parameter(description = "set/catalog id", required = true) @QueryParam("set") String set,
			@Parameter(description = "metadata prefix", required = true) @QueryParam("metadataPrefix") String metadataPrefix,
			@Parameter(description = "id metadataset", required = false) @QueryParam("metadataset") String metadataset,
			@Parameter(description = "importer job class name (call /classes to obtain a list)", required = true, schema = @Schema(defaultValue="org.edu_sharing.repository.server.jobs.quartz.ImporterJob")) @QueryParam("className") String className,
			@Parameter(description = "importer class name (call /classes to obtain a list)", required = false, schema = @Schema(defaultValue="org.edu_sharing.repository.server.importer.OAIPMHLOMImporter")) @QueryParam("importerClassName") String importerClassName,
			@Parameter(description = "RecordHandler class name", required = false, schema = @Schema(defaultValue="org.edu_sharing.repository.server.importer.RecordHandlerLOM")) @QueryParam("recordHandlerClassName") String recordHandlerClassName,
			@Parameter(description = "BinaryHandler class name (may be empty for none)", required = false, schema = @Schema(defaultValue="")) @QueryParam("binaryHandlerClassName") String binaryHandlerClassName,
		    @Parameter(description = "PersistentHandlerClassName class name (may be empty for none)", required = false, schema = @Schema(defaultValue="")) @QueryParam("persistentHandlerClassName") String persistentHandlerClassName,
			@Parameter(description = "url to file", required = false) @QueryParam("fileUrl") String fileUrl,
			@Parameter(description = "OAI Ids to import, can be null than the whole set will be imported", required = false, schema = @Schema(defaultValue="")) @QueryParam("oaiIds") String oaiIds,
			@Parameter(description = "force Update of all entries", required = false, schema = @Schema(defaultValue="false")) @QueryParam("forceUpdate") Boolean forceUpdate,
			@Parameter(description = "from: datestring yyyy-MM-dd)", required = false, schema = @Schema(defaultValue="")) @QueryParam("from") String from,
			@Parameter(description = "until: datestring yyyy-MM-dd)", required = false, schema = @Schema(defaultValue="")) @QueryParam("until") String until,
		  	@Parameter(description = "periodInDays: internal sets from and until. only effective if from/until not set)", required = false, schema = @Schema(defaultValue="")) @QueryParam("periodInDays") String periodInDays,
		    @Context HttpServletRequest req) {
		try {
			AdminServiceFactory.getInstance().importOai(set, fileUrl, baseUrl, metadataset, metadataPrefix, className,
					importerClassName, recordHandlerClassName, binaryHandlerClassName,persistentHandlerClassName, oaiIds, forceUpdate != null ? forceUpdate.booleanValue() : false, from, until, periodInDays);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@POST
	@Path("/import/oai/xml")
	@Operation(summary = "Import single xml via oai (for testing)")
	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Node.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response importOaiXML (@Parameter(description = "RecordHandler class name", required = false, schema = @Schema(defaultValue="org.edu_sharing.repository.server.importer.RecordHandlerLOM")) @QueryParam("recordHandlerClassName") String recordHandlerClassName,
							  @Parameter(description = "BinaryHandler class name (may be empty for none)", required = false, schema = @Schema(defaultValue="")) @QueryParam("binaryHandlerClassName") String binaryHandlerClassName,
							  @FormDataParam("xml") InputStream xml,
								@Context HttpServletRequest req) {
		try {
			String node=AdminServiceFactory.getInstance().importOaiXml(xml, recordHandlerClassName, binaryHandlerClassName);
			if(node==null) {
				throw new Exception("Importer failed to create node");
			}
			Node result=NodeDao.getNode(RepositoryDao.getHomeRepository(),node,Filter.createShowAllFilter()).asNode();
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/import/oai")
	@Hidden

	public Response options7() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, POST, DELETE").build();
	}

	@GET
	@Path("/import/oai/classes")

	@Operation(summary = "Get OAI class names", description = "Get available importer classes for OAI import.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = String[].class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getOaiClasses(@Context HttpServletRequest req) {
		try {
			List<String> result =
					AdminServiceFactory.getInstance().getImporterClasses().stream().
							map(Class::getName).collect(Collectors.toList());
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/import/oai/classes")
	@Hidden

	public Response options8() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}

	@POST
	@Path("/import/refreshCache/{folder}")

	@Operation(summary = "Refresh cache", description = "Refresh importer cache.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response refreshCache(
			@Parameter(description = "refresh cache root folder id", schema = @Schema(defaultValue="-userhome-"), required = true) @PathParam("folder") String rootFolder,
			@Parameter(description = "sticky", required = true, schema = @Schema(defaultValue="false")) @QueryParam("sticky") Boolean sticky,
			@Context HttpServletRequest req) {
		try {
			AdminServiceFactory.getInstance().startCacheRefreshingJob(NodeDao.mapNodeConstants(RepositoryDao.getHomeRepository(),rootFolder), sticky != null && sticky);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/import/refreshCache/{folder}")
	@Hidden

	public Response options9() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, POST").build();
	}

	@DELETE
	@Path("/import/oai")

	@Operation(summary = "Remove deleted imports", description = "Remove deleted imports.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response removeOaiImports(
			@Parameter(description = "base url", required = true) @QueryParam("baseUrl") String baseUrl,
			@Parameter(description = "set/catalog id", required = true) @QueryParam("set") String set,
			@Parameter(description = "metadata prefix", required = true) @QueryParam("metadataPrefix") String metadataPrefix,
			@Context HttpServletRequest req) {
		try {
			AdminServiceFactory.getInstance().removeDeletedImports(baseUrl, set, metadataPrefix);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@GET
	@Path("/propertyToMds")

	@Operation(summary = "Get a Mds Valuespace for all values of the given properties", description = "Get a Mds Valuespace for all values of the given properties.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = String.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getPropertyToMds(
			@Parameter(description = "one or more properties", required = true) @QueryParam("properties") List<String> properties,
			@Context HttpServletRequest req) {
		try {
			XMLResult result = new XMLResult();
			result.setXml(AdminServiceFactory.getInstance().getPropertyToMDSXml(properties));
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/propertyToMds")
	@Hidden

	public Response options10() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}

	@GET
	@Path("/clusterInfo")
	@Operation(summary = "Get information about the Cluster", description = "Get information the Cluster")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = CacheCluster.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getCluster(@Context HttpServletRequest req) {
		try {
			CacheCluster result = AdminServiceFactory.getInstance().getCacheCluster();
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/clusterInfo")
	@Hidden

	public Response options11() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}

	@GET
	@Path("/clusterInfos")
	@Operation(summary = "Get information about the Cluster", description = "Get information the Cluster")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = CacheCluster.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getClusters(@Context HttpServletRequest req) {
		try {
			List<CacheCluster> result = AdminServiceFactory.getInstance().getCacheClusters();
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/clusterInfos")
	@Hidden

	public Response options12() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}

	@POST
	@Path("/mail/{receiver}/{template}")
	@Operation(summary = "Test a mail template", description = "Sends the given template as a test to the given receiver.")
	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="409", description=RestConstants.HTTP_409, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })

	public Response testMail(
			@Parameter(required = true) @PathParam("receiver") String receiver,
			@Parameter(required = true) @PathParam("template") String template,
			@Context HttpServletRequest req) {
		try {
			AdminServiceFactory.getInstance().testMail(receiver,template);
			return Response.ok().build();
		} catch (NotAnAdminException e) {
			return ErrorResponse.createResponse(e);
		} catch (Exception e) {
			return ErrorResponse.createResponse(e);
		}

	}

	@GET
	@Path("/export/lom")

	@Operation(summary = "Export Nodes with LOM Metadata Format", description = "Export Nodes with LOM Metadata Format.")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response exportLOM(
			@Parameter(description = "filterQuery", required = true) @QueryParam("filterQuery") String filterQuery,
			@Parameter(description = "targetDir", required = true) @QueryParam("targetDir") String targetDir,
			@Parameter(description = "subObjectHandler", required = true) @QueryParam("subObjectHandler") Boolean subObjectHandler,
			@Context HttpServletRequest req) {
		try {
			AdminServiceFactory.getInstance().exportLom(filterQuery, targetDir, subObjectHandler);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/export/lom")
	@Hidden

	public Response options13() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}

	@POST
	@Path("/job/{jobClass}")
	@Operation(summary = "Start a Job.", description = "Start a Job.")
	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="409", description=RestConstants.HTTP_409, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })

	public Response startJob(
			@Parameter(description = "jobClass", required = true) @PathParam("jobClass") String jobClass,
			@Parameter(description = "params", required = true) HashMap<String, Serializable> params,
			@Context HttpServletRequest req) {
		try {
			AdminServiceFactory.getInstance().startJob(jobClass, new HashMap<String,Object>(params));
			return Response.ok().build();
		} catch (NotAnAdminException e) {
			return ErrorResponse.createResponse(e);
		} catch (Exception e) {
			return ErrorResponse.createResponse(e);
		}

	}
	@POST
	@Path("/job/{jobClass}/sync")
	@Operation(summary = "Start a Job.", description = "Start a Job. Wait for the result synchronously")
	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Object.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="409", description=RestConstants.HTTP_409, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })

	public Response startJobSync(
			@Parameter(description = "jobClass", required = true) @PathParam("jobClass") String jobClass,
			@Parameter(description = "params", required = true) HashMap<String, Serializable> params,
			@Context HttpServletRequest req) {
		try {
			Object result = AdminServiceFactory.getInstance().startJobSync(jobClass, new HashMap<>(params));
			return Response.ok().entity(result).build();
		} catch (NotAnAdminException e) {
			return ErrorResponse.createResponse(e);
		} catch (Throwable e) {
			return ErrorResponse.createResponse(e);
		}

	}

	@OPTIONS
	@Path("/job")
	@Hidden

	public Response options14() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, POST").build();
	}

	@GET
	@Path("/elastic")
	@Consumes({ "application/json" })

	@Operation(summary = "Search for custom elastic DSL query")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = SearchResultElastic.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })

	public Response searchByElasticDSL(
			@Parameter(description = "dsl query (json encoded)", schema = @Schema(defaultValue="")) @QueryParam("dsl") String dsl,
			@Context HttpServletRequest req) {

		try {

			//check that there is an admin
			AdminServiceFactory.getInstance();
			SearchServiceElastic elastic = new SearchServiceElastic(ApplicationInfoList.getHomeRepository().getAppId());
			SearchResultNodeRefElastic search = elastic.searchDSL(dsl);
			RepositoryDao repoDao = RepositoryDao.getHomeRepository();
			List<Node> data = new ArrayList<Node>();
			for (org.edu_sharing.service.model.NodeRef ref : search.getData()) {
				try {
					data.add(NodeDao.getNode(repoDao, ref).asNode());
				}catch(Throwable t){
					logger.warn("Error mapping elastic node " + ref.getNodeId(), t);
				}
			}

			Pagination pagination = new Pagination();
			pagination.setFrom(search.getStartIDX());
			pagination.setCount(data.size());
			pagination.setTotal(search.getNodeCount());

			SearchResultElastic<Node> response = new SearchResultElastic<>();

			response.setNodes(data);
			response.setPagination(pagination);

			XContentBuilder builder = XContentFactory.jsonBuilder().prettyPrint();
			search.getElasticResponse().toXContent(builder, ToXContent.EMPTY_PARAMS);
			response.setElasticResponse(Strings.toString(builder));
			return Response.status(Response.Status.OK).entity(response).build();

		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}
	@GET
	@Path("/lucene")
	@Consumes({ "application/json" })

	@Operation(summary = "Search for custom lucene query", description = "e.g. @cm\\:name:\"*\"")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = SearchResult.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })

	public Response searchByLucene(
			@Parameter(description = "query", schema = @Schema(defaultValue="@cm\\:name:\"*\"") ) @QueryParam("query") String query,
			@Parameter(description = "maximum items per page", schema = @Schema(defaultValue="10") ) @QueryParam("maxItems") Integer maxItems,
			@Parameter(description = "skip a number of items", schema = @Schema(defaultValue="0") ) @QueryParam("skipCount") Integer skipCount,
			@Parameter(description = RestConstants.MESSAGE_SORT_PROPERTIES) @QueryParam("sortProperties") List<String> sortProperties,
			@Parameter(description = RestConstants.MESSAGE_SORT_ASCENDING) @QueryParam("sortAscending") List<Boolean> sortAscending,
			@Parameter(description = "property filter for result nodes (or \"-all-\" for all properties)", array = @ArraySchema(schema = @Schema(defaultValue="-all-")) ) @QueryParam("propertyFilter") List<String> propertyFilter,
			@Parameter(description = "store, workspace or archive") @QueryParam("store") LuceneStore store,
			@Parameter(description = "authority scope to search for") @QueryParam("authorityScope") List<String> authorityScope,
			@Context HttpServletRequest req) {

		try {

			//check that there is an admin
			AdminServiceFactory.getInstance();

			Filter filter = new Filter(propertyFilter);
			RepositoryDao repoDao = RepositoryDao.getHomeRepository();

			SearchToken token = new SearchToken();
			token.setSortDefinition(new SortDefinition(sortProperties, sortAscending));
			token.setFrom(skipCount != null ? skipCount : 0);
			token.setMaxResult(maxItems != null ? maxItems : RestConstants.DEFAULT_MAX_ITEMS);
			token.setContentType(ContentType.ALL);
			token.setLuceneString(query);
			StoreRef storeRef = LuceneStore.Archive.equals(store) ? StoreRef.STORE_REF_ARCHIVE_SPACESSTORE : StoreRef.STORE_REF_WORKSPACE_SPACESSTORE;
			if (LuceneStore.Archive.equals(store)) {
				token.setStoreName(storeRef.getIdentifier());
				token.setStoreProtocol(storeRef.getProtocol());
			}
			token.disableSearchCriterias();
			token.setAuthorityScope(authorityScope);
			NodeSearch search = NodeDao.search(repoDao, token, false);

			List<Node> data = new ArrayList<Node>();
			for (org.edu_sharing.restservices.shared.NodeRef ref : search.getResult()) {
				data.add(NodeDao.getNode(repoDao, storeRef.getProtocol(), storeRef.getIdentifier(), ref.getId(), filter).asNode());
			}

			Pagination pagination = new Pagination();
			pagination.setFrom(search.getSkip());
			pagination.setCount(data.size());
			pagination.setTotal(search.getCount());

			SearchResult response = new SearchResult();
			response.setNodes(data);
			response.setPagination(pagination);
			response.setFacets(search.getFacets());
			return Response.status(Response.Status.OK).entity(response).build();

		} catch (DAOException e) {
			return ErrorResponse.createResponse(e);
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@OPTIONS
	@Path("/lucene")
	@Hidden

	public Response options03() {

		return Response.status(Response.Status.OK).header("Allow", "OPTIONS, GET").build();
	}

	@GET
	@Path("/lucene/export")
	@Consumes({ "application/json" })

	@Operation(summary = "Search for custom lucene query and choose specific properties to load", description = "e.g. @cm\\:name:\"*\"")

	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = List.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })

	public Response exportByLucene(
			@Parameter(description = "query", schema = @Schema(defaultValue="@cm\\:name:\"*\"") ) @QueryParam("query") String query,
			@Parameter(description = RestConstants.MESSAGE_SORT_PROPERTIES) @QueryParam("sortProperties") List<String> sortProperties,
			@Parameter(description = RestConstants.MESSAGE_SORT_ASCENDING) @QueryParam("sortAscending") List<Boolean> sortAscending,
			@Parameter(description = "properties to fetch, use parent::<property> to include parent property values") @QueryParam("properties") List<String> properties,
			@Parameter(description = "store, workspace or archive") @QueryParam("store") LuceneStore store,
			@Parameter(description = "authority scope to search for") @QueryParam("authorityScope") List<String> authorityScope,
			@Context HttpServletRequest req) {

		try {

			//check that there is an admin
			AdminServiceFactory.getInstance();
			RepositoryDao repoDao = RepositoryDao.getHomeRepository();


			List<Map<String,Serializable>> data = new ArrayList<>();
			//
			boolean haseMore = true;
			int pageSize = 1000;
			int page = 0;
			do{

				SearchToken token = new SearchToken();
				token.setSortDefinition(new SortDefinition(sortProperties, sortAscending));
				token.setFrom(page);
				token.setMaxResult(pageSize);
				token.setContentType(ContentType.ALL);
				token.setLuceneString(query);
				token.disableSearchCriterias();
				token.setAuthorityScope(authorityScope);
				StoreRef storeRef = LuceneStore.Archive.equals(store) ? StoreRef.STORE_REF_ARCHIVE_SPACESSTORE : StoreRef.STORE_REF_WORKSPACE_SPACESSTORE;
				if (LuceneStore.Archive.equals(store)) {
					token.setStoreName(storeRef.getIdentifier());
					token.setStoreProtocol(storeRef.getProtocol());
				}
				NodeSearch search = NodeDao.search(repoDao, token, false);
				logger.info("page: "+ page +" count:"+search.getCount() +" t:"+Thread.currentThread().getId());
				page = page + pageSize;
				if((search.getCount() - 1) <= page){
					haseMore = false;
				}
				for (org.edu_sharing.restservices.shared.NodeRef ref : search.getResult()) {
					NodeRef alfRef=new NodeRef(storeRef, ref.getId());
					Map<String, Serializable> props=new HashMap<>();
					for(String prop : properties){
						if(prop.startsWith("parent::")){
							String parentId = NodeServiceFactory.getLocalService().getPrimaryParent(ref.getId());
							String realProp=prop.substring("parent::".length());
							props.put(prop, NodeServiceHelper.getPropertyNative(new NodeRef(StoreRef.STORE_REF_WORKSPACE_SPACESSTORE,parentId),CCConstants.getValidGlobalName(realProp)));
						}
						else{
							props.put(prop, NodeServiceHelper.getPropertyNative(alfRef,CCConstants.getValidGlobalName(prop)));
						}
					}
					data.add(props);
				}

			}while(haseMore);

			logger.info("result:" + data.size());
			String tempDir = System.getProperty("java.io.tmpdir");
			String protocolFile = tempDir + "/" + "edu_export_lucene.txt";
			try (Writer writer = new FileWriter(protocolFile)) {
				Gson gson = new GsonBuilder().create();
				gson.toJson(data, writer);
			}
			//
			return Response.status(Response.Status.OK).entity(data).build();

		} catch (DAOException e) {
			return ErrorResponse.createResponse(e);
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}


	@PUT
	@Path("/deletePersons")
	@Operation(summary = "delete persons", description = "delete the given persons. Their status must be set to \"todelete\"")
	@ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = PersonReport.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response deletePerson(
			@Parameter(description = "names of the users to delete", required = true) @QueryParam("username") List<String> username,
			@Parameter(description = "options object what and how to delete user contents") PersonDeleteOptions options,
			@Context HttpServletRequest req) {
		try {
			PersonReport result=new PersonLifecycleService().deletePersons(username,options);
			return Response.ok().entity(result).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}


    @POST
    @Path("/log")
    @Operation(summary = "Change the loglevel for classes at runtime.", description = "Root appenders are used. Check the appender treshold.")
    @ApiResponses(value = { @ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
            @ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode="409", description=RestConstants.HTTP_409, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })

	public Response changeLogging(
			@Parameter(description = "name", required = true) @QueryParam("name") String name,
			@Parameter(description = "loglevel", required = true) @QueryParam("loglevel") String loglevel,
			@Parameter(description = "appender", schema = @Schema(defaultValue="File") ) @QueryParam("appender") String appender,
			@Context HttpServletRequest req) {
		try {

			//check that there is an admin
			AdminServiceFactory.getInstance();

			if(name.startsWith("org.alfresco") ||
					name.startsWith("org.edu_sharing.alfresco") ||
					name.startsWith("org.edu_sharing.repository.server.tools.cache")) {
				ClassLoader clAlf = AlfAppContextGate.getApplicationContext().getClassLoader();

				Class<?> logManager = clAlf.loadClass("org.apache.log4j.LogManager");
				Method methodGetLogger = logManager.getMethod("getLogger", String.class);
				Object logger = methodGetLogger.invoke(null, name);

				Class<?> logLevelClass = clAlf.loadClass("org.apache.log4j.Level");
				Method methodToLevel = logLevelClass.getMethod("toLevel",String.class);
				Method methodSetLevel = logger.getClass().getMethod("setLevel",logLevelClass);
				methodSetLevel.invoke(logger, methodToLevel.invoke(null, loglevel));

				/*Method methodGetRootLogger = logger.getClass().getMethod("getRootLogger", null);
				Object rootLogger = methodGetRootLogger.invoke(null, null);

				Method methodGetAppender = rootLogger.getClass().getMethod("getAppender", String.class);
				Object appenderObj = methodGetAppender.invoke(rootLogger, appender);

				Class<?> priorityClass = clAlf.loadClass("org.apache.log4j.Priority");
				Method methodToPriority = priorityClass.getMethod("toPriority", String.class);
				Object priorityObj = methodToPriority.invoke(null, loglevel);
				Method methodSetTreshold = appenderObj.getClass().getMethod("setThreshold", priorityClass);
				methodSetTreshold.invoke(appenderObj, priorityObj);

				Method methodAddAppender = logger.getClass().getMethod("addAppender", clAlf.loadClass("org.apache.log4j.Appender"));
				methodAddAppender.invoke(logger, appenderObj);*/
            }else {
                Logger logger = LogManager.getLogger(name);
                logger.setLevel(Level.toLevel(loglevel));

                /**
                 * logger is auto added to root appender, so we don't need to do this, maybe we can check if the reshhold of the appender is enough for the logger
                 */
				/*Logger rootLogger = Logger.getRootLogger();
				System.out.println("rootLogger:" + rootLogger.getName());
				Appender appenderObj = rootLogger.getAppender(appender);
				System.out.println("appenderObj:" + appenderObj.getName() + " " + ((AppenderSkeleton)appenderObj).getThreshold() +" appenders:"+ logger.getAllAppenders().hasMoreElements());
				*/



                //	((AppenderSkeleton)appenderObj).setThreshold(Priority.toPriority(loglevel, Priority.INFO));
                //	logger.addAppender(appenderObj);
            }

            return Response.status(Response.Status.OK).build();
        } catch (NotAnAdminException e) {
            return ErrorResponse.createResponse(e);
        } catch (Exception e) {
            return ErrorResponse.createResponse(e);
        }

    }


	@GET
	@Path("/repositoryConfig")
	@Operation(summary = "get the repository config object")
	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = RepositoryConfig.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getConfig(@Context HttpServletRequest req) {
		try {
			return Response.ok().entity(AdminServiceFactory.getInstance().getConfig()).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}
	@PUT
	@Path("/repositoryConfig")
	@Operation(summary = "set/update the repository config object")
	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response setConfig(@Context HttpServletRequest req,RepositoryConfig config) {
		try {
			AdminServiceFactory.getInstance().setConfig(config);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}
	@GET
	@Path("/configFile")
	@Operation(summary = "get a base system config file (e.g. edu-sharing.conf)")
	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = String.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getConfigFile(@Context HttpServletRequest req,
								  @Parameter(description = "filename to fetch", required = true) @QueryParam("filename") String filename
								  ) {
		try {
			String content=AdminServiceFactory.getInstance().getConfigFile(filename);
			return Response.ok().entity(content).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}
	@GET
	@Path("/config/merged")
	@Operation(description = "Get the fully merged & parsed (lightbend) backend config")
	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Object.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response getLightbendConfig(@Context HttpServletRequest req) {
		try {
			return Response.ok().entity(
					AdminServiceFactory.getInstance().getLightbendConfig()
			).build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	@PUT
	@Path("/configFile")
	@Operation(summary = "update a base system config file (e.g. edu-sharing.conf)")
	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response updateConfigFile(@Context HttpServletRequest req,
									 @Parameter(description = "filename to fetch", required = true) @QueryParam("filename") String filename,
									 String content) {
		try {
			AdminServiceFactory.getInstance().updateConfigFile(filename,content);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}
	@POST
	@Path("/authenticate/{authorityName}")
	@Operation(summary = "switch the session to a known authority name")
	@ApiResponses(value = {
			@ApiResponse(responseCode="200", description=RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
			@ApiResponse(responseCode="400", description=RestConstants.HTTP_400, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="401", description=RestConstants.HTTP_401, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="403", description=RestConstants.HTTP_403, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="404", description=RestConstants.HTTP_404, content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
			@ApiResponse(responseCode="500", description=RestConstants.HTTP_500, content = @Content(schema = @Schema(implementation = ErrorResponse.class))) })
	public Response switchAuthority(@Context HttpServletRequest req,
									 @Parameter(description = "the authority to use (must be a person)") @PathParam("authorityName") String authorityName) {
		try {
			AdminServiceFactory.getInstance().switchAuthentication(authorityName);
			return Response.ok().build();
		} catch (Throwable t) {
			return ErrorResponse.createResponse(t);
		}
	}

	public enum LuceneStore {
		Workspace,
		Archive
	}
}
