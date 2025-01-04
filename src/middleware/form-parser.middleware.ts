import { NextFunction, Request, Response } from "express";

export function formDataParser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.body) {
    return next();
  }

  const parsedBody: Record<string, any> = {};

  Object.keys(req.body).forEach((key) => {
    if (key.includes("[") && key.includes("]")) {
      const [parent, child] = key.split("[");
      const cleanChild = child.replace("]", "");

      if (!parsedBody[parent]) {
        parsedBody[parent] = {};
      }
      parsedBody[parent][cleanChild] = req.body[key];
    } else {
      parsedBody[key] = req.body[key];
    }
  });

  req.body = parsedBody;
  next();
}
