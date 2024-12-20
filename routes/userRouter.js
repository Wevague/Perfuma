const express= require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/user/userController');
const otpController  = require('../controllers/user/otpController');
const paypalController = require('../controllers/user/paypalController');
const { userAuth } = require('../middlewares/auth');

router.use((req,res,next)=>{
    res.locals.user = req.session.user || null

    const cartCount = req.session.cartCount || 0;
    res.locals.cartCount = cartCount;

    next()
})

router.get('/signup',userController.loadSignup)
router.get('/pageNotFound',userController.pageNotFound);
router.get('/',userController.loadHomepage);
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resendOtp);
router.get('/forgot-password',otpController.ForgotPassword);
router.post('/forgot-email-valid',otpController.forgotEmailValid);
router.post('/verify-passForgot-otp',otpController.verifyForgotPassOtp);
router.get('/reset-password',otpController.getResetPassPage);
router.post('/resend-forgot-otp',otpController.resendOtp);
router.post('/reset-password',otpController.postNewPassword)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/login',userController.loadLogin);
router.post('/login',userController.login)
router.get('/logout',userController.logout);
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res,next)=>{
    if(req.session?.passport?.user){
        req.session.user = req.session.passport.user
    }
    next()
},(req,res)=>{
    res.redirect('/')
});
router.use(userAuth)
router.get('/home',userController.loadHomepage)
router.get('/shop',userController.loadShopPage)
router.get('/productDetails', userController.loadProductPage);
router.get('/userProfile',userController.loadProfilePage);
router.get('/MyAddress',userController.myaddressPage);
router.get('/Orderlist',userController.OrderlistPage);
router.post('/itemcancelOrder/:orderId/:itemId', userController.removeItemFromOrder);
router.get('/downloadInvoice/:orderId/:itemId',userController.getInvoice);
router.get('/EditProfile',userController.editProfilePage);
router.get('/addAddress',userController.addAddressPage);
router.post('/addNewAddress', userController.saveAddress);
router.post('/deleteAddress/:addressId', userController.deleteAddress);
router.post('/editProfile', userController.editProfile);
router.get('/editAddress', userController.editAddressPage);
router.post('/editAddress', userController.updateAddress);
router.get('/cart',userController.loadCartPage);
router.post('/cart',userController.addToCart);
router.get('/cart/remove/:productId/:volume', userController.removeFromCart);
router.put('/cart/update',userController.updateCart);
router.get('/checkout',userController.loadcheckout);
router.post('/place-order',userController.placeOrder);
router.post('/paypal/place-order',paypalController.manageOrder);
router.post('/paypal/orders/:orderID/capture',paypalController.verifyPayment);
router.post('/updateOrderStatus/:orderId',paypalController.CancelPayment);
router.get('/paypal/payment/retry/:orderId',paypalController.retryPayment);
router.post('/paypal/orders/:orderId/capture-retry',paypalController.captureRetryPayment);


router.get('/wishlist',userController.addTowishlist);
router.post('/wishlist',userController.addTowishlist);
router.delete('/wishlist/remove',userController. removeFromWishlist);
router.get('/search',userController.loadSearch)
router.post('/apply-coupon',userController.applyCoupon);
router.post('/remove-coupon',userController.removeCoupon);
router.get('/wallet',userController.loadWallet);


router.post('/returnOrder/:orderId',userController.returnOrder);
router.post('/returnItemOrder/:orderId/:productid',userController.returnItemOrder);



router.get('/orderconfirm',userController.loadOrderConfirm)



module.exports = router;