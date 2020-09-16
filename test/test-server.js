const express = require('express')
const app = express()
const proxy = require('../create-proxy')
const PausingTransform = require('pausing-transform')


let p = proxy({
	remoteHostUrl: "https://www.spam.com",
	captureResponseContent: false
})

p.options.requestTransformers.push((req, proxyRequest) => {
	if(proxyRequest.remoteUrl.includes('wp-admin')
		|| proxyRequest.remoteUrl.includes('gf_page')
		|| proxyRequest.remoteUrl.includes('.php')) {
			// This is some sort of wp admin page, and it's going to need cookies here
			proxyRequest.needsCookies = true
	}
	else {
		proxyRequest.needsCookies = false
	}
})

p.options.cleanRequestParameters.push((orgReq, proxyRequest) => {
	if(!proxyRequest.needsCookies) {
		delete proxyRequest.backendRequestParms.headers.cookie
	}
})


p.options.cleanResponseHeaders.push((orgReq, backendRes, proxyRequest) => {
	if(!proxyRequest.needsCookies) {
		delete proxyRequest.headers['set-cookie']
	}
})

p.options.createBodyTransformer.push(
	(req, proxyRequest) => {
		if(proxyRequest.headers['content-type'] && proxyRequest.headers['content-type'].includes('text/html')) {
			return new PausingTransform(function(content) {
				return content.split('https://www.spam.com').join('http://localhost:3000')
			})
		}
	}
)



app.use(p)
 
app.listen(3000)