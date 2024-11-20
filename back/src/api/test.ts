import express from "express";
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    res.locals.response.message = "OK";

    res.json({
      headers: req.headers,
      ip: res.locals.log.ip,
    });
  } catch (error) {
    next(error);
  }
});
router.post("/", async (req, res, next) => {
  try {
    res.locals.response.message = "OK";

    res.json({
      headers: req.headers,
      ip: res.locals.log.ip,
      body: req.body,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
