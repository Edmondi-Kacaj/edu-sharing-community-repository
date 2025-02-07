package org.edu_sharing.lightbend;

import com.typesafe.config.Config;
import com.typesafe.config.ConfigFactory;
import org.edu_sharing.alfresco.lightbend.LightbendConfigCache;
import org.edu_sharing.alfresco.lightbend.LightbendConfigLoader;
import org.edu_sharing.repository.server.tools.HttpQueryTool;
import org.edu_sharing.service.connector.ConnectorServiceFactory;

public class LightbendConfigHelper {

    public static void refresh() {
        LightbendConfigLoader.refresh();
        ConnectorServiceFactory.invalidate(); // reinit connectors data
        HttpQueryTool.invalidateProxySettings(); // reinit proxy settings
    }
}
