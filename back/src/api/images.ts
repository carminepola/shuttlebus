import express from 'express';
const router = express.Router();
import uploadImagesMiddleware from '../middlewares/uploadImage';
import authMiddleware from '../middlewares/authMiddleware';
import checkPermissionMiddleware from '../middlewares/checkPermissionMiddleware';
import { role } from '../enum/role';
import path from 'path';
router.get(
  '/:imageName',
  (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  async (req, res, next) => {
    try {
      const { imageName } = req.params;
      const imagePath = path.join(process.cwd(), 'uploads', imageName);

      res.sendFile(imagePath);
    } catch (error) {
      next(error);
    }
  },
);
router.post('/', uploadImagesMiddleware, authMiddleware, checkPermissionMiddleware(role.ADMIN, ['MANAGE_CONTENT']), async (req, res, next) => {
  try {
    res.json({
      image: req.body.imagePaths,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
