package org.edu_sharing.repository.server;

import com.google.gson.Gson;
import org.apache.log4j.Level;
import org.apache.log4j.Logger;
import org.edu_sharing.repository.server.tools.URLTool;
import org.edu_sharing.restservices.shared.ErrorResponse;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;


public class ErrorFilter implements Filter {
	public static class ErrorFilterException extends ServletException {
		private int statusCode;
		public ErrorFilterException(int statusCode, Throwable t) {
			super(t);
			this.statusCode = statusCode;
		}
		public ErrorFilterException(int statusCode) {
			super();
			this.statusCode = statusCode;
		}

		public int getStatusCode() {
			return statusCode;
		}

		public void setStatusCode(int statusCode) {
			this.statusCode = statusCode;
		}
	}

	// stores the currently accessing tool type, e.g. CONNECTOR
	public static ThreadLocal<String> accessToolType = new ThreadLocal<>();

	Logger logger = Logger.getLogger(ErrorFilter.class);

	ServletContext context;

	@Override
	public void destroy() {
	}

	@Override
	public void init(FilterConfig config) throws ServletException {
		this.context=config.getServletContext();
	}

	@Override
	public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
		try {
			chain.doFilter(req, res);
		} catch(Throwable t) {
			int statusCode = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
			if(t instanceof ErrorFilterException) {
				statusCode = ((ErrorFilterException) t).getStatusCode();
			}
			handleError((HttpServletRequest) req, (HttpServletResponse)res, t, statusCode);
		}
	}

	public static void handleError(HttpServletRequest req, HttpServletResponse resp, Throwable t, int statusCode) {
		try {
			resp.reset();
			ErrorResponse response = new ErrorResponse();
			response.setError(statusCode + "");
			if (Logger.getLogger(ErrorFilter.class).getEffectiveLevel().toInt() <= Level.INFO_INT) {
				response.setMessage(t != null ? t.getMessage() : statusCode+"");
			} else {
				response.setMessage("LogLevel is > INFO");
			}
			resp.setStatus(500);
			String accept = req.getHeader("accept");
			if (accept!=null && accept.toLowerCase().contains("text/html")) {
				resp.getWriter().print("<script>window.location.href=\"" + URLTool.getNgErrorUrl(statusCode + "") + "\";</script>");
			} else if(accept!=null && accept.toLowerCase().contains("application/json")) {
				resp.setHeader("Content-Type", "application/json");
				resp.getWriter().print(new Gson().toJson(response));
			}
			else {
				resp.setHeader("Content-Type", "plain/text");
				resp.getWriter().print(response.toString());
			}
		}catch(IOException e){
			Logger.getLogger(ErrorFilter.class).error("Fatal error delivering error to client", e);
		}
	}


}
