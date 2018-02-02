package org.edu_sharing.service.stream.model;

public class StreamSearchRequest {
	public String authority;
	public ContentEntry.Audience.STATUS status;
	public String category;
	public String search;
	public int offset=0;
	public int size=0;
	public StreamSearchRequest(String authority,ContentEntry.Audience.STATUS status) {
		this.authority=authority;
		this.status=status;
	}
}
