const through = require('through2')
const URL = require('url')

const filog = require('filter-log')
let log = filog('express-proxy-handler')

const request = require('request')


/**
 * 
 * @param {object} options 
 * @property {string} remoteHostUrl - The URL starting url (to which the user's request path will be appended)
 * @property {array[function]} requestTransformers - Functions which determine the requested path and content type
 * @return {function} An express handler function which will cache requests
 * @example
 * 		create({
 * 			remoteHostUrl: 'https://example.com'
 * 		})
 */
let create = (options) => {

	let cacheInfo = {}
	log.error('proxy created')

	if (!options.requestTransformers) {
		let requestTransformers = [(req, proxyRequest) => {
			let path = proxyRequest.proxyPath = URL.parse(req.url).pathname
			if (path.indexOf('ScriptResource') >= 0 || path.indexOf('GetResource') >= 0 || path.indexOf('PortalTemplate') >= 0 || path.indexOf('GetCSS') >= 0) {
				path = proxyRequest.proxyPath = path + '?' + URL.parse(req.url).query
			}
			if (path.endsWith('.css')) {
				proxyRequest.contentType = 'text/css'
			}
			if (path.endsWith('.js')) {
				proxyRequest.contentType = 'text/javascript'
			}
			proxyRequest.remoteUrl = req.url
		}]
		options.requestTransformers = requestTransformers
	}

	let proxy = (req, res, next) => {

		let proxyRequest = {
			contentType: null,
			contentEncoding: null,
			proxyPath: null
		}

		for(let transformer of options.requestTransformers) {
			transformer(req, proxyRequest)
		}


		if (cacheInfo[proxyRequest.proxyPath]) {
			res.setHeader('Content-Type', cacheInfo[proxyRequest.proxyPath].contentType)
			if (cacheInfo[proxyRequest.proxyPath].contentEncoding) {
				res.setHeader('Content-Encoding', cacheInfo[proxyRequest.proxyPath].contentEncoding)
			}
			res.end(cacheInfo[proxyRequest.proxyPath].buf)
		}
		else {
			try {
				let curBuffer = null

				let cachePipe = through(function (buf, enc, next) {
					if (curBuffer) {
						curBuffer = Buffer.concat([curBuffer, buf]);
					}
					else {
						curBuffer = buf
					}
					this.push(buf)
					next()
				})
				cachePipe.on('end', () => {
					proxyRequest.buf = curBuffer
					cacheInfo[proxyRequest.proxyPath] = proxyRequest
				})

				let r = request(options.remoteHostUrl + proxyRequest.remoteUrl)
				r.on('response', (data) => {
					if(data.headers['content-type']) {
						proxyRequest.contentType = data.headers['content-type']
					}
					if(data.headers['content-encoding']) {
						proxyRequest.contentEncoding = data.headers['content-encoding']
					}
					res.setHeader('Content-Type', proxyRequest.contentType)
					if (proxyRequest.contentEncoding) {
						res.setHeader('Content-Encoding', proxyRequest.contentEncoding)
					}
				})
				r.pipe(cachePipe).pipe(res)
			} catch(e) {
				log.error(e)
			}
			
		}
	}

	proxy.options = options
	proxy.cacheInfo = cacheInfo

	return proxy
}

module.exports = create