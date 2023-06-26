package org.edu_sharing.restservices.notification.v1;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.edu_sharing.restservices.ApiService;
import org.edu_sharing.restservices.DAOException;
import org.edu_sharing.restservices.RestConstants;
import org.edu_sharing.service.notification.NotificationConfig;
import org.edu_sharing.service.notification.NotificationServiceFactoryUtility;
import org.edu_sharing.service.notification.events.NotificationEventDTO;
import org.edu_sharing.service.notification.events.data.Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.RequestParam;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;

@Path("/notification/v1")
@Tag(name = "NOTIFICATION v1")
@ApiService(value = "NOTIFICATION", major = 1, minor = 0)
@Consumes({"application/json"})
@Produces({"application/json"})
public class NotificationApi {

    @GET
    @Path("/config")
    @Operation(summary = "get the config for notifications of the current user")
    @ApiResponses(
            value = {
                    @ApiResponse(responseCode = "200", description = RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = NotificationConfig.class))),
            })

    public Response getConfig(@Context HttpServletRequest req) throws DAOException {
        try {
            return Response.ok(NotificationServiceFactoryUtility.getLocalService().getConfig()).build();
        } catch (Throwable t) {
            throw DAOException.mapping(t);
        }
    }

    @PUT
    @Path("/config")
    @Operation(summary = "Update the config for notifications of the current user")
    @ApiResponses(
            value = {
                    @ApiResponse(responseCode = "200", description = RestConstants.HTTP_200, content = @Content(schema = @Schema(implementation = Void.class))),
            })
    public Response setConfig(@Context HttpServletRequest req, NotificationConfig config) throws DAOException {
        try {
            NotificationServiceFactoryUtility.getLocalService().setConfig(config);
            return Response.ok().build();
        } catch (Throwable t) {
            throw DAOException.mapping(t);
        }
    }


    @GET
    @Path("/notifications")
    @Parameters({
            @Parameter(name = "receiverId", description = "receiver identifier",
                    in = ParameterIn.QUERY, schema = @Schema(type = "string", defaultValue = "-me-")),
            @Parameter(name = "status", description = "status (or conjunction)",
                    in = ParameterIn.QUERY, content = @Content(array = @ArraySchema(schema = @Schema(implementation = Status.class)))),
            @Parameter(name = "page", description = "page number",
                    in = ParameterIn.QUERY, schema = @Schema(type = "integer", defaultValue = "0")),
            @Parameter(name = "size", description = "page size",
                    in = ParameterIn.QUERY, schema = @Schema(type = "integer", defaultValue = "25")),
            @Parameter(name = "sort", description = "Sorting criteria in the format: property(,asc|desc)(,ignoreCase). "
                    + "Default sort order is ascending. " + "Multiple sort criteria are supported."
                    , in = ParameterIn.QUERY, content = @Content(array = @ArraySchema(schema = @Schema(type = "string"))))
    })
    @Operation(summary = "Retrieve stored notification, filtered by receiver and status",
            responses = @ApiResponse(responseCode = "200",
                    description = "get the received notifications",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = NotificationResponsePage.class))))
    public Response getNotifications(
            @QueryParam("receiverId") String receiverId,
            @QueryParam("status") List<Status> status,
            @QueryParam("page") int page,
            @QueryParam("size") int size,
            @QueryParam("sort") List<String> sort) throws DAOException {

        try {
            List<Sort.Order> orders = new ArrayList<>();
            if (sort != null && !sort.isEmpty()) {
                for (String sortParam : sort) {
                    String[] sortParams = sortParam.split(",");
                    Sort.Order order = Sort.Order.by(sortParams[0]);
                    for (int i = 1; i < sortParam.length(); i++) {
                        if (sortParams[i].equalsIgnoreCase("desc")) {
                            order.with(Sort.Direction.DESC);
                        } else if (sortParams[i].equalsIgnoreCase("asc")) {
                            order.with(Sort.Direction.ASC);
                        } else if (sortParams[i].equalsIgnoreCase("ignoreCase")) {
                            order.ignoreCase();
                        }
                    }
                    orders.add(order);
                }
            }

            PageRequest pageRequest = PageRequest.of(page, size, Sort.by(orders));
            return Response.ok(new NotificationResponsePage(NotificationServiceFactoryUtility.getLocalService().getNotifications(receiverId, status, pageRequest))).build();
        } catch (Throwable t) {
            throw DAOException.mapping(t);
        }
    }

    static class NotificationResponsePage extends PageImpl<NotificationEventDTO> {
        public NotificationResponsePage(Page<NotificationEventDTO> page) {
            super(page.getContent(), page.getPageable(), page.getTotalElements());
        }
    }

    @PUT
    @Path("/notifications/status")
    @Operation(summary = "Endpoint to update the notification status")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200",
                    description = "set notification status",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = NotificationEventDTO.class)))
    })
    public Response updateNotificationStatus(
            @QueryParam("id") String id,
            @QueryParam("status") @DefaultValue(value = "READ") Status status
    ) throws DAOException {
        try {
            return Response.ok(NotificationServiceFactoryUtility.getLocalService().setNotificationStatus(id, Status.NEW)).build();
        } catch (Throwable t) {
            throw DAOException.mapping(t);
        }
    }

    @DELETE
    @Path("/notifications")
    @Operation(summary = "Endpoint to delete notification by id",
            responses = @ApiResponse(responseCode = "200", description = "deleted notification"))
    public Response deleteNotification(@QueryParam("id") String id) throws DAOException {
        try {
            NotificationServiceFactoryUtility.getLocalService().deleteNotification(id);
            return Response.ok().build();
        } catch (Throwable t) {
            throw DAOException.mapping(t);
        }
    }

}