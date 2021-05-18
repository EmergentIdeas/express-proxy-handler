module.exports = (headers) => {
	delete headers['host']
	delete headers['connection']
	delete headers['keep-alive']
	delete headers['accept-encoding']
	delete headers['if-none-match']
	delete headers['if-modified-since']
}