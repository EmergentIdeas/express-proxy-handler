const through = require('through2')
const URL = require('url')

const filog = require('filter-log')
const PausingTransform = require('pausing-transform')
let log = filog('express-proxy-handler')

const request = require('request')
const addCallbackToPromise = require('./add-callback-to-promise')

/**
 * 
 * @param {object} options 
 * @property {string} remoteHostUrl - The URL starting url (to which the user's request path will be appended)
 * @property {array[function]} requestTransformers - Functions which determine the requested path and content type
 * @property {function} responseFinishedHandler - Function to handle the information collected by the request, by default, caching it for later use.
 * @property {function} captureResponseHeaders - Function to grap the response headers from the backend server respose
 * @property {array[function]} cleanResponseHeaders - removes/updates headers from the proxyRequest object before it is stored
 * @property {function} applyResponseHeaders - Function which applies the headers received from the backend server to the response being delivered to the user
 * @property {function} accessAllowed(req, proxyRequest, callback) - Function to control if this request is allowed, returns promise
 * @property {function} handleAccessDenied(req, proxyRequest, response) - Function to tell the user that their request was denied
 * @property {function} createRequestIdentity - Returns a string which acts as an identifier for this request
 * @property {array[function]} createBodyTransformer - an array of functions, called with the request and requestProxy, which allows the specification of a stream which should be used to transform data. Functions return streams.
 * @property {array{function}} cleanRequestParameters(req, proxyRequest) - cleans, updates, and removes headers and the url prior to being used for the request
 * @property boolean captureResponseContent - if true, will capture to a buffer the content of the response body
 * @return {function} An express handler function which will cache requests
 * @example
 * 		create({
 * 			remoteHostUrl: 'https://example.com'
 * 		})
 */
let create = (options = {}) => {

	options.cacheInfo = {}

	this.configOptions = require('./configure-options')
	this.configOptions(options)

	let proxy = function(req, res, next) {

		let proxyRequest = {
			contentType: null,
			contentEncoding: null,
			proxyPath: null,
			backendRequestParms: null
		}

		for(let transformer of options.requestTransformers) {
			transformer(req, proxyRequest)
		}
		
		const cleanValue = (val) => {
			if(val && typeof val == 'string') {
				val = val.split(req.protocol + "://" + req.headers.host).join(options.remoteHostUrl)
			}
			return val
		}
		
		const removeRequestHeaders = require('./remove-request-headers')

		options.accessAllowed(req, proxyRequest).then(allowed => {
			if(allowed) {
				let method = req.method.toLowerCase()
				if(method == 'post' || method == 'put') {
					
					let reqParms = proxyRequest.backendRequestParms = {
						method: req.method,
						uri: options.remoteHostUrl + proxyRequest.remoteUrl,
						headers: {}
					}

					for(let key of Object.keys(req.headers)) {
						reqParms.headers[key] = cleanValue(req.headers[key])
					}
					
					removeRequestHeaders(reqParms.headers)
					
					let proxyResponse = request(reqParms)
						
					proxyResponse.on('response', data => {
						// res.status(data.statusCode)
						options.captureResponseHeaders(req, data, proxyRequest)
						for(let clean of options.cleanResponseHeaders) {
							clean(req, data, proxyRequest)
						}
						res.status(data.statusCode)
						options.applyResponseHeaders(req, proxyRequest, res)
						let headPipe = r.pipe(cachePipe)
						for(let transformer of options.createBodyTransformer) {
							let trans = transformer(req, proxyRequest)
							if(trans) {
								headPipe = headPipe.pipe(trans)
							}
							
						}
						headPipe.pipe(res)

					})
					
					req.pipe(proxyResponse)
					
					proxyResponse.pipe(res)
				
					
					
					return
				}

				
				
				
				if (options.cacheInfo[proxyRequest.proxyPath]) {
					proxyRequest = options.cacheInfo[proxyRequest.proxyPath]
					options.applyResponseHeaders(req, proxyRequest, res)
					res.end(options.cacheInfo[proxyRequest.proxyPath].buf)
				}
				else {
					let curBuffer = null
					let cachePipe = through(function (buf, enc, next) {
						if(options.captureResponseContent) {
							if (curBuffer) {
								curBuffer = Buffer.concat([curBuffer, buf]);
							}
							else {
								curBuffer = buf
							}
						}
						this.push(buf)
						next()
					})
					cachePipe.on('end', () => {
						options.responseFinishedHandler(req, proxyRequest, curBuffer)
					})

					let reqParms = proxyRequest.backendRequestParms = {
						method: req.method,
						uri: options.remoteHostUrl + proxyRequest.remoteUrl,
						headers: []
					}
					
					for(let key of Object.keys(req.headers)) {
						reqParms.headers[key] = cleanValue(req.headers[key])
					}
					
					removeRequestHeaders(reqParms.headers)
					
					for(let clean of options.cleanRequestParameters) {
						clean(req, proxyRequest)
					}
					
					let r = request(reqParms)
					
					r.on('response', (data) => {
						options.captureResponseHeaders(req, data, proxyRequest)
						for(let clean of options.cleanResponseHeaders) {
							clean(req, data, proxyRequest)
						}
						res.status(data.statusCode)
						options.applyResponseHeaders(req, proxyRequest, res)
						let headPipe = r.pipe(cachePipe)
						for(let transformer of options.createBodyTransformer) {
							let trans = transformer(req, proxyRequest)
							if(trans) {
								headPipe = headPipe.pipe(trans)
							}
							
						}
						headPipe.pipe(res)
					})
					
				}
			}
			else {
				options.handleAccessDenied(req, proxyRequest, res)
			}
		})

		
	}
;


	proxy.options = options

	return proxy
}

module.exports = create