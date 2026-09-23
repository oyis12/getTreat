import {
  createBaby,
  getBabies,
  getBaby,
  updateBaby,
  deleteBaby,
  addBabyPhoto,
  updateBabyPhoto,
  deleteBabyPhoto
} from "../services/baby.service.js";

export const createBabyController = async (
  req,
  res,
  next
) => {
  try {
    const baby = await createBaby(
      req.user.id,
      req.body
    );

    return res.status(201).json({
      success: true,
      msg: "Baby created successfully",
      data: baby,
    });
  } catch (error) {
    next(error);
  }
};

export const getBabiesController = async (
  req,
  res,
  next
) => {
  try {
    const babies = await getBabies(
      req.user.id
    );

    return res.status(200).json({
      success: true,
      msg: "Babies retrieved successfully",
      data: babies,
    });
  } catch (error) {
    next(error);
  }
};

export const getBabyController = async (
  req,
  res,
  next
) => {
  try {
    const baby = await getBaby(
      req.user.id,
      req.params.babyId
    );

    return res.status(200).json({
      success: true,
      msg: "Baby retrieved successfully",
      data: baby,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBabyController = async (
  req,
  res,
  next
) => {
  try {
    const baby = await updateBaby(
      req.user.id,
      req.params.babyId,
      req.body
    );

    return res.status(200).json({
      success: true,
      msg: "Baby updated successfully",
      data: baby,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBabyController = async (
  req,
  res,
  next
) => {
  try {
    const result = await deleteBaby(
      req.user.id,
      req.params.babyId
    );

    return res.status(200).json({
      success: true,
      msg: "Baby deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const addBabyPhotoController = async (req, res, next) => {
  try {
    const photo = await addBabyPhoto(
      req.user.id,
      req.params.babyId,
      req.file
    );

    res.status(201).json({
      success: true,
      msg: "Baby photo added successfully",
      data: photo,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBabyPhotoController = async (req, res, next) => {
  try {
    const photo = await updateBabyPhoto(
      req.user.id,
      req.params.babyId,
      req.params.photoId,
      req.file
    );

    res.status(200).json({
      success: true,
      msg: "Baby photo updated successfully",
      data: photo,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBabyPhotoController = async (req, res, next) => {
  try {
    const result = await deleteBabyPhoto(
      req.user.id,
      req.params.babyId,
      req.params.photoId
    );

    res.status(200).json({
      success: true,
      msg: "Baby photo deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};