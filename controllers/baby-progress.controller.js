import {
  addGrowthRecord,
  getGrowthHistory,
  getBabyProgress,
  getBabyProgressReport,
} from "../services/baby-progress.service.js";

export const addGrowthRecordController = async (req, res, next) => {
  try {
    const growth = await addGrowthRecord(
      req.user.id,
      req.params.babyId,
      req.body
    );

    return res.status(201).json({
      success: true,
      msg: "Baby growth recorded successfully",
      data: growth,
    });
  } catch (error) {
    next(error);
  }
};

export const getGrowthHistoryController = async (req, res, next) => {
  try {
    const data = await getGrowthHistory(
      req.user.id,
      req.params.babyId,
      req.query
    );

    return res.status(200).json({
      success: true,
      msg: "Baby growth history retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getBabyProgressController = async (req, res, next) => {
  try {
    const data = await getBabyProgress(
      req.user.id,
      req.params.babyId,
      req.query
    );

    return res.status(200).json({
      success: true,
      msg: "Baby progress retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getBabyProgressReportController = async (req, res, next) => {
  try {
    const data = await getBabyProgressReport(
      req.user.id,
      req.params.babyId,
      req.query
    );

    return res.status(200).json({
      success: true,
      msg: "Baby progress report retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};
