const User = require('../models/userSChema');


const userAuth = (req, res, next) => {
    if (req.session.user) {

        User.findById(req.session.user)
            .then(data => {
                if (data && !data.isBlocked) {
                    next();
                } else {
                    res.render('login')
                }
            })
            .catch(error => {
                console.log('Error in user auth middleware');
                res.status(500).send('Internal Server error')

            })
    } else {
        res.render('login')
    }
}
const adminAuth = async (req, res, next) => {
    try {
        const admin = await User.findOne({ isAdmin: true })
        const adminId = admin._id
        if (adminId.toString() !== req.session.admin) {
            req.session.destroy()
            return res.redirect('/admin/login')
        } else {
            next()
        }
    } catch (error) {
        console.log('Error in server')
        return res.status(500).send('internal Server error')
    }
}


module.exports = {
    userAuth,
    adminAuth
}