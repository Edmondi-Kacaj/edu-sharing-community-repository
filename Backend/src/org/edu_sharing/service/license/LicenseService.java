package org.edu_sharing.service.license;

import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;
import org.edu_sharing.repository.server.tools.URLTool;

public class LicenseService {

	public String getIconUrl(String license,boolean dynamic){
		if(license==null || license.isEmpty())
			license="none";
		String ccImageName = license.toLowerCase().replace("_", "-")+".svg";
		String url = URLTool.getBaseUrl(dynamic) + "/ccimages/licenses/" + ccImageName;

		return url;
	}
	public String getIconUrl(String license){
		return getIconUrl(license,true);
	}

	public String getLicenseUrl(String license, String locale){
		return getLicenseUrl(license, locale, null);
	}

	public String getLicenseUrl(String license, String locale, String version){
		if(license==null || license.isEmpty())
			return null;
		String result = this.buildLicenseUrl(license);
		if(result != null){
			// if no jurisdiction is given, remove it from the url
			if (result.contains("${jurisdiction}")) {
				result = result.replace("${jurisdiction}/", "");
			}
			version = (version == null) ? "3.0" : version;
			if(result.contains("${version}")){
				result = result.replace("${version}", version);
			}
			locale = (locale == null) ? "en" : locale.split("_")[0];
			if(result.contains("${locale}")){
				result = result.replace("${locale}", locale.toLowerCase());
			}
		}
		return result;
	}

	public String getLicenseUrl(String license, String locale, String version, String jurisdiction){
		if(license==null || license.isEmpty())
			return null;

		version = (version == null) ? "3.0" : version;
		locale = (locale == null) ? "en" : locale.split("_")[0];

		// If no jurisdiction is given or version is 4.0, call the getLicenseUrl method without jurisdiction
		if (jurisdiction == null || jurisdiction.isEmpty() || version.equals("4.0"))
			return this.getLicenseUrl(license, locale, version);

		String result = this.buildLicenseUrl(license);

		if(result != null){

			if(result.contains("${version}")){
				result = result.replace("${version}", version);
			}

			if (result.contains("${jurisdiction}")) {
				result = result.replace("${jurisdiction}", jurisdiction.toLowerCase());
			}

			if(result.contains("${locale}")){
				result = result.replace("${locale}", locale.toLowerCase());
			}
		}
		return result;
	}

	/**
	 * @param license, the license  to check example : CC_BY_NC
	 * @return String , the license link example: https://creativecommons.org/licenses/by-nc/${version}/${jurisdiction}/deed.${locale} || null if no license is available
	 */
	private String buildLicenseUrl(String license){
		if(license==null || license.isEmpty())
			return null;
		if (license.equals(CCConstants.COMMON_LICENSE_CC_BY)) {
			return CCConstants.COMMON_LICENSE_CC_BY_LINK;
		}
		if (license.equals(CCConstants.COMMON_LICENSE_CC_ZERO)) {
			return CCConstants.COMMON_LICENSE_CC_ZERO_LINK;
		}
		if (license.equals(CCConstants.COMMON_LICENSE_CC_BY_NC)) {
			return CCConstants.COMMON_LICENSE_CC_BY_NC_LINK;
		}
		if (license.equals(CCConstants.COMMON_LICENSE_CC_BY_NC_ND)) {
			return CCConstants.COMMON_LICENSE_CC_BY_NC_ND_LINK;
		}
		if (license.equals(CCConstants.COMMON_LICENSE_CC_BY_NC_SA)) {
			return CCConstants.COMMON_LICENSE_CC_BY_NC_SA_LINK;
		}
		if (license.equals(CCConstants.COMMON_LICENSE_CC_BY_ND)) {
			return CCConstants.COMMON_LICENSE_CC_BY_ND_LINK;
		}
		if (license.equals(CCConstants.COMMON_LICENSE_CC_BY_SA)) {
			return CCConstants.COMMON_LICENSE_CC_BY_SA_LINK;
		}
		if (license.equals(CCConstants.COMMON_LICENSE_EDU_NC)) {
			return CCConstants.COMMON_LICENSE_EDU_LINK;
		}

		if (license.equals(CCConstants.COMMON_LICENSE_EDU_NC_ND)) {
			return CCConstants.COMMON_LICENSE_EDU_LINK;
		}
		return null;
	}
}
