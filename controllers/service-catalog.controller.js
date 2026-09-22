import * as serviceCatalogService from "../services/service-catalog.service.js";
import { sendSuccess } from "../utils/response.js";

export const getServices = async (req, res, next) => {
  try {
    const data = await serviceCatalogService.getActiveServices({
      category: req.query.category || null,
    });

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Services retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getServices,
};
