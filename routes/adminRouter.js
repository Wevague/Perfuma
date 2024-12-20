const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const brandController = require('../controllers/admin/brandController');
const productController = require('../controllers/admin/productController');
const salesReportContoller = require('../controllers/admin/salesReportContoller');
const { adminAuth } = require('../middlewares/auth');


const multer  = require('multer');
const storage = require('../helpers/multer');
const uploads = multer({storage:storage});


router.get('/pageerror',adminController.pageerror)
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/logout',adminController.AdminLogout);
router.get('/dashboard',adminAuth,adminController.loadDashboard)


router.get('/users',adminAuth,customerController.customerInfo);
router.get('/blockCustomer',adminAuth,customerController.curstomerBlocked);
router.get('/unblockCustomer',adminAuth,customerController.curstomerunBlocked);


router.get('/category',adminAuth,categoryController.categoryInfo);
router.post('/addCategory',adminAuth,categoryController.addCategory);
router.post('/addCategoryOffer', adminAuth, categoryController.addCategoryOffer);
router.post('/removeCategoryOffer',adminAuth,categoryController.removeCategoryOffer);
router.get('/listCategory',adminAuth,categoryController.getListCategory);
router.get('/unlistCategory',adminAuth,categoryController.getUnlistCategory);
router.get('/editCategory',adminAuth,categoryController.getEditCategory);
router.post('/editCategory/:id',adminAuth,categoryController.editCategory);
router.post('/softDeleteCategory', adminAuth, categoryController.softDeleteCategory);
router.get('/brands',adminAuth,brandController.getBrandPage);
router.post('/addBrands',adminAuth,uploads.single('image'),brandController.addBrand);
router.get('/orderLIst',adminAuth,adminController.loadOrderListpage);
router.get('/order', adminAuth, adminController.showOrder);

router.post('/orderLIst',adminAuth,adminController.updateOrderStatus);
router.patch('/cancelOrder',adminAuth,adminController. cancelOrder);
router.get('/manageCoupon',adminAuth,adminController.Coupon);
router.get('/addCoupon',adminAuth,adminController.loadAddCoupon);
router.post('/add-coupon',adminAuth,adminController.addCoupon);
router.get('/deleteCoupon',adminAuth,adminController.couponDelete);
router.get('/addProducts',adminAuth,productController.getProductAddPage);
router.post('/addProducts',adminAuth,uploads.array('images',4),productController.addProducts);
router.get('/products',adminAuth,productController.getAllProducts);
router.get('/blockProduct',adminAuth,productController.blockProduct);
router.get('/unblockProduct',adminAuth,productController.unblockProduct);


router.get('/returnOrderlist',adminAuth,adminController.returnOrder);
router.post('/acceptReturn',adminAuth,adminController.acceptReturnOrder);
router.post('/rejecttReturn',adminAuth,adminController.rejectReturnOrder);
router.get('/salesReport',adminAuth,salesReportContoller.salesReport);
router.get('/productOffer',adminAuth,productController.ProductOffer);
router.get('/offeradd',adminAuth,productController.loadaddnewOffer);
router.get('/deleteOffer',adminAuth,productController.deleteOffer);
router.get('/updateOffer',adminAuth,productController.editOffer);
router.post('/updatedOffer',adminAuth,productController.updateEditOffer);
router.post('/Newofferadd',adminAuth,productController.addOffer)


router.get('/editProduct',adminAuth,productController.getEditProduct);
router.post('/editProduct/:id',adminAuth,uploads.array('images',4),productController.editProduct);
router.post('/deleteImage',adminAuth,productController.deleteSingleImage);









module.exports = router;
