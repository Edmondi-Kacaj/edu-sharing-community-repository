package org.edu_sharing.alfresco.service.toolpermission;

import net.sf.acegisecurity.AuthenticationCredentialsNotFoundException;
import org.alfresco.repo.security.authentication.AuthenticationUtil;
import org.alfresco.service.ServiceRegistry;
import org.alfresco.service.cmr.repository.NodeRef;
import org.alfresco.service.cmr.repository.NodeService;
import org.alfresco.service.cmr.repository.StoreRef;
import org.alfresco.service.cmr.security.AccessStatus;
import org.alfresco.service.cmr.security.PermissionService;
import org.apache.commons.lang3.NotImplementedException;
import org.apache.log4j.Logger;
import org.edu_sharing.alfrescocontext.gate.AlfAppContextGate;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.alfresco.repository.server.authentication.Context;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;
import org.springframework.context.ApplicationContext;

import javax.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

public class ToolPermissionBaseService {
    private Logger logger = Logger.getLogger(ToolPermissionBaseService.class);
    protected ApplicationContext applicationContext = AlfAppContextGate.getApplicationContext();
    protected ServiceRegistry serviceRegistry = (ServiceRegistry) applicationContext.getBean(ServiceRegistry.SERVICE_REGISTRY);
    protected PermissionService permissionService = serviceRegistry.getPermissionService();
    protected NodeService nodeService = serviceRegistry.getNodeService();
    protected static Map<String,String> toolPermissionNodeCache = new HashMap<>();

    protected boolean isAdmin(){
        try {
            Set<String> testUsetAuthorities = serviceRegistry.getAuthorityService().getAuthorities();
            for (String testAuth : testUsetAuthorities) {
                if (testAuth.equals("GROUP_ALFRESCO_ADMINISTRATORS")) {
                    return true;
                }
            }
            return AuthenticationUtil.isRunAsUserTheSystemUser();
        }catch(AuthenticationCredentialsNotFoundException ignored){
            // may causes missing security context exceptions
            return false;
        }
    }

    private boolean hasToolPermissionWithoutCache(String toolPermission) {
        final String repoAdmin = ApplicationInfoList.getHomeRepository().getUsername();
        AuthenticationUtil.RunAsWork<String> workTP= new AuthenticationUtil.RunAsWork<String>() {
            @Override
            public String doWork() throws Exception {
                try {
                    return getToolPermissionNodeId(toolPermission);
                } catch (Throwable e) {
                    logger.error(e.getMessage(), e);
                    return null;
                }
            }
        };

        try{
            if (isAdmin()) {
                return true;
            }
        }catch(Exception e){

        }

        String toolNodeId = AuthenticationUtil.runAsSystem(workTP);
        if(toolNodeId == null){
            logger.warn("Could not fetch toolpermission " + toolPermission + "in alfresco context, fallback to false");
            return false;
        }
        AccessStatus accessStatus = permissionService.hasPermission(new NodeRef(StoreRef.STORE_REF_WORKSPACE_SPACESSTORE, toolNodeId), PermissionService.READ);
        AccessStatus accessStatusDenied = permissionService.hasPermission(new NodeRef(StoreRef.STORE_REF_WORKSPACE_SPACESSTORE, toolNodeId), CCConstants.PERMISSION_DENY);
        if(accessStatusDenied.equals(AccessStatus.ALLOWED)) {
            logger.info("Toolpermission "+toolPermission+" has explicit Deny permission");;
        }
        return accessStatus.equals(AccessStatus.ALLOWED) && !accessStatusDenied.equals(AccessStatus.ALLOWED);
    }


    public boolean hasToolPermission(String toolPermission) {
        return hasToolPermission(toolPermission, false);
    }

    /**
     *
     * @param toolPermission
     * @param renew should the cache be skipped / renewed
     * @return
     */
    public boolean hasToolPermission(String toolPermission, boolean renew) {
        try{
            if(isAdmin()){
                return true;
            }
        }catch(Exception e){
            logger.error(e.getMessage(),e);
        }

        /**
         * try to use session cache
         */
        Boolean hasToolPerm = false;
        HttpSession session = null;
        if(Context.getCurrentInstance() != null){
            session = Context.getCurrentInstance().getRequest().getSession();
            hasToolPerm = (Boolean)session.getAttribute(toolPermission);
        }else{
            renew = true;
        }

        if(hasToolPerm == null || renew){
            hasToolPerm = hasToolPermissionWithoutCache(toolPermission);
            if(session != null) {
                session.setAttribute(toolPermission, hasToolPerm);
            }
        }
        return hasToolPerm;
    }

    protected String getToolPermissionNodeId(String toolPermission) throws Throwable{
        throw new NotImplementedException("getToolPermissionNodeId is not implemented in alfresco context");
    }
}
