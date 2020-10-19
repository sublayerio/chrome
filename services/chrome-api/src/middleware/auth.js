const extractTokenFromHeaders = (headers) => {
    const { authorization } = headers
    if (!authorization) {
        return null
    }
    const parts = authorization.split(' ')
    if (parts.length !== 2) {
        return null
    }
    if (parts[0] !== 'Bearer') {
        return null
    }
    // if (globalId.isOfType('key', parts[1]) === false) return null
    return parts[1]
}

module.exports = async (req, res, next) => {

    let token = req.query.token

    if (!token) {
        token = extractTokenFromHeaders(req.headers)
    }

    console.log('token', token)

    if (!token || token !== process.env.API_KEY) {
        res.send({
            status: 'error',
            message: 'unauthorized'
        })
        return
    }

    next()
}