package org.edu_sharing.alfresco.service.config.model;

import jakarta.xml.bind.annotation.XmlElement;
import java.io.Serializable;

public class Contexts implements Serializable {
	@XmlElement	public Context[] context;
}
