import { sendSuccess } from "../utils/response.js";
import AppError from "../utils/AppError.js";

import * as authService from "../services/auth.service.js";

export const signup = async (req, res, next) => {
  try {
    const data = await authService.signup(req.body, req);

    return sendSuccess(res, {
      statusCode: 201,
      msg: "User saved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};


export const signin = async (req, res, next) => {
  try {
    console.log("🔥 SIGNIN CONTROLLER HIT");

    const data = await authService.signin(
      req.body.email,
      req.body.password,
      req
    );

    console.log("🔥 SIGNIN SERVICE SUCCESS");

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Successfully authenticated",
      data,
    });
  } catch (error) {
    console.error("🔥 SIGNIN CONTROLLER ERROR:", error);
    next(error);
  }
};
// export const signin = async (req, res, next) => {
//   try {
//     const data = await authService.signin(
//       req.body.email,
//       req.body.password,
//       req
//     );

//     return sendSuccess(res, {
//       statusCode: 200,
//       msg: "Successfully authenticated",
//       data,
//     });
//   } catch (error) {
//     next(error);
//   }
// };


export const verify = async (req, res, next) => {
  try {
    await authService.verifyEmail(
      req.body.email,
      req.body.code
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Email verified successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};


export const resend = async (req, res, next) => {
  try {
    await authService.resendVerification(
      req.body.email
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Verification code resent successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};


export const forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(
      req.body.email
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Password reset request processed successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};


export const newPassword = async (req, res, next) => {
  try {
    await authService.newPassword(
      req.body.email,
      req.body.code,
      req.body.password
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Password updated successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};


export const completeProfile = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new AppError(
        "Authentication required",
        401
      );
    }

    const data = await authService.completeProfile(
      req.user.id,
      req.body
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Profile completed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};


export const refreshToken = async (req, res, next) => {
  try {
    const data =
      await authService.refreshAccessToken(
        req.body.refresh_token,
        req
      );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Token refreshed successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};


export const logout = async (req, res, next) => {
  try {
    await authService.logout(
      req.body.refresh_token
    );

    return sendSuccess(res, {
      statusCode: 200,
      msg: "Successfully logged out",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};