package org.edu_sharing.service.config.model;
import org.apache.log4j.Logger;

import java.io.Serializable;
import java.util.List;

import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement
public class Config {

	Logger logger=Logger.getLogger(Config.class);

	@XmlElement public Values values;
	@XmlElement public Contexts contexts;
	@XmlElement public List<Language> language;
	@XmlElement public Variables variables;

	/**
	 * Return The current value set in client.config for the given config object
	 * @param name current value, path seperated by ".", e.g. "register.local"
	 * @param defaultValue default Value fallback if value was not found (must be the same type as the expected value type)
	 * @param <T>
	 * @return
	 * @throws NoSuchFieldException
	 * @throws IllegalAccessException
	 */
    public <T>T getValue(String name, T defaultValue) throws NoSuchFieldException, IllegalAccessException {
		String[] path = name.split("\\.");
		Object data = values;
		try {
			for (String p : path) {
				data = data.getClass().getDeclaredField(p).get(data);
			}
			return (T) data;
		}catch(Exception e){
			logger.info(name+" not found: "+e.getMessage());
			return defaultValue;
		}
    }
}
