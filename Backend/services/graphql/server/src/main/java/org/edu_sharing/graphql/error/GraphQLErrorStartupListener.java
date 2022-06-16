package org.edu_sharing.graphql.error;

import graphql.kickstart.execution.error.GraphQLErrorHandler;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationListener;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.support.ClassPathXmlApplicationContext;

public class GraphQLErrorStartupListener implements ApplicationListener<ContextRefreshedEvent> {


    private final ErrorHandlerSupplier errorHandlerSupplier;
    private final boolean exceptionHandlersEnabled;

    public GraphQLErrorStartupListener(ErrorHandlerSupplier errorHandlerSupplier, boolean exceptionHandlersEnabled) {
        this.errorHandlerSupplier = errorHandlerSupplier;
        this.exceptionHandlersEnabled = exceptionHandlersEnabled;
    }


    @Override
    public void onApplicationEvent(ContextRefreshedEvent event) {
        if (!errorHandlerSupplier.isPresent()) {
            ConfigurableApplicationContext context = (ConfigurableApplicationContext) event.getApplicationContext();
            GraphQLErrorHandler errorHandler = new GraphQLErrorHandlerFactory().create(context, exceptionHandlersEnabled);
            context.getBeanFactory()
                    .registerSingleton(errorHandler.getClass().getCanonicalName(), errorHandler);
            errorHandlerSupplier.setErrorHandler(errorHandler);
        }
    }
}
