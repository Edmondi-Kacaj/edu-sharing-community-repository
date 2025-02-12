/**
 *
 *  
 * 
 * 
 *	
 *
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 *
 */
package org.edu_sharing.repository.server.jobs.quartz;

import org.edu_sharing.repository.server.RepoFactory;
import org.edu_sharing.repository.server.jobs.quartz.annotation.JobDescription;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

@JobDescription(description = "This job triggers a cache reload of the application caches and metadatasets")
public class InvalidateApplicationCacheJob extends AbstractJobMapAnnotationParams implements JobClusterLocker.ClusterSingelton {
	public InvalidateApplicationCacheJob(){
	}
	@Override
	protected void executeInternal(JobExecutionContext jobExecutionContext) throws JobExecutionException {
		RepoFactory.refresh();
	}
}
