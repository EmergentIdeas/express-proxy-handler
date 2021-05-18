const addCallbackToPromise = require('./add-callback-to-promise')


let config = function(options) {
	if (!options.requestTransformers) {
		let requestTransformers = [(req, proxyRequest) => {
			proxyRequest.proxyPath = options.createRequestIdentity(req)
			proxyRequest.remoteUrl = req.url
		}]
		options.requestTransformers = requestTransformers
	}
	
	if(!options.responseFinishedHandler) {
		options.responseFinishedHandler = (req, proxyRequest, contentBuffer) => {
			if(options.captureResponseContent && proxyRequest.statusCode == 200) {
				proxyRequest.buf = contentBuffer
				options.cacheInfo[proxyRequest.proxyPath] = proxyRequest
			}
		}
	}
	
	if(typeof options.captureResponseContent == 'undefined') {
		options.captureResponseContent = true
	}
	
	if(!options.captureResponseHeaders) {
		options.captureResponseHeaders = (orgReq, backendRes, proxyRequest) => {
			proxyRequest.headers = {}
			for(let key of Object.keys(backendRes.headers)) {
				if(key == 'connection') {
					continue
				}
				proxyRequest.headers[key] = backendRes.headers[key]
			}
			proxyRequest.statusCode = backendRes.statusCode
		}
	}
	
	if(!options.applyResponseHeaders) {
		options.applyResponseHeaders = (req, proxyRequest, response) => {
			for(let key of Object.keys(proxyRequest.headers)) {
				if(key == 'date') {
					continue
				}
				if(key == 'content-length') {
					continue
				}
				response.setHeader(key, proxyRequest.headers[key])
			}
		}
	}
	
	if(!options.accessAllowed) {
		options.accessAllowed = (req, proxyRequest, callback) => {
			let p = new Promise((resolve, reject) => {
				resolve(true)
			})
			return addCallbackToPromise(p, callback)
		}
	}
	
	if(!options.handleAccessDenied) {
		options.handleAccessDenied = (req, proxyRequest, response) => {
			response.status(401).end()
		}
	}
	
	if(!options.createRequestIdentity) {
		options.createRequestIdentity = (req) => {
			let path
			try {
				let theUrl = new URL(req.url)
				path = theUrl.pathname
				if(theUrl.query) {
					path += '?' + theUrl.query
				}
			}
			catch(e) {
				path = req.url
			}

			return req.method + ':' + path
		}
	}
	
	if(!options.cleanRequestParameters) {
		options.cleanRequestParameters = [(req, proxyRequest) => {
			/* these are in proxyRequest.backendRequestParms */
		}]
	}
	
	if(!options.cleanResponseHeaders) {
		options.cleanResponseHeaders = [(orgReq, backendRes, proxyRequest) => {
			
		}]
	}
	
	if(!options.createBodyTransformer) {
		options.createBodyTransformer = []
	}

}

module.exports = config