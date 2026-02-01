import express from "express";
const router = express.Router();

import  RikoAI  from "../Controllers/RikoAI.js";


router.post('/api/RikoChat', RikoAI)
router.get("/api/RikoChat", (req, res) => {
    res.json({
      status: "success for contact ",
      message: "Server is running",
    });
  });

  


export default router;
