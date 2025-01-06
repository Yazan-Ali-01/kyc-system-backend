import { KYC } from "@/models/kyc.model";
import Logger from "@/utils/logger";
import { ResponseFormatter } from "@/utils/response-formatter";
import { Request, Response } from "express";

export class ReportsController {
  private static instance: ReportsController;

  private constructor() {}

  public static getInstance(): ReportsController {
    if (!ReportsController.instance) {
      ReportsController.instance = new ReportsController();
    }
    return ReportsController.instance;
  }

  public getOverviewStats = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const now = new Date();
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));

      const [
        totalStats,
        todaySubmissions,
        averageProcessingTime,
        weeklyComparison,
      ] = await Promise.all([
        KYC.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),

        KYC.countDocuments({
          submissionDate: { $gte: startOfToday },
        }),

        KYC.aggregate([
          {
            $match: {
              reviewDate: { $exists: true },
              submissionDate: { $exists: true },
            },
          },
          {
            $project: {
              processingTime: {
                $divide: [
                  { $subtract: ["$reviewDate", "$submissionDate"] },
                  3600000,
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              averageTime: { $avg: "$processingTime" },
            },
          },
        ]),

        this.calculateWeeklyComparison(),
      ]);

      const statusCounts = totalStats.reduce((acc: any, curr: any) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {});

      const total = Object.values(statusCounts).reduce(
        (a: any, b: any) => a + b,
        0
      );
      const completedCount =
        (statusCounts.approved || 0) + (statusCounts.rejected || 0);

      const stats = {
        total,
        pending: statusCounts.pending || 0,
        approved: statusCounts.approved || 0,
        rejected: statusCounts.rejected || 0,
        todaySubmissions,
        averageProcessingTime: averageProcessingTime[0]?.averageTime || 0,
        completionRate:
          (total as number) > 0
            ? (completedCount / (total as number)) * 100
            : 0,
        weekOverWeek: weeklyComparison,
      };

      res.json(
        ResponseFormatter.success(
          stats,
          "Overview statistics retrieved successfully"
        )
      );
    } catch (error) {
      Logger.error("Error fetching overview stats:", error);
      throw error;
    }
  };

  private async calculateWeeklyComparison() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [thisWeek, lastWeek] = await Promise.all([
      KYC.countDocuments({
        submissionDate: { $gte: oneWeekAgo, $lt: now },
      }),
      KYC.countDocuments({
        submissionDate: { $gte: twoWeeksAgo, $lt: oneWeekAgo },
      }),
    ]);

    const percentageChange =
      lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;

    return {
      percentageChange,
      isPositive: percentageChange > 0,
    };
  }
  public getTimelineData = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();
    endDate.setHours(23, 59, 59, 999);

    try {
      const timelineData = await KYC.aggregate([
        {
          $match: {
            submissionDate: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$submissionDate" },
            },
            submissions: { $sum: 1 },
            approved: {
              $sum: {
                $cond: [{ $eq: ["$status", "approved"] }, 1, 0],
              },
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ["$status", "rejected"] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            submissions: 1,
            approved: 1,
            rejected: 1,
          },
        },
        {
          $sort: { date: 1 },
        },
      ]);

      res.json(
        ResponseFormatter.success(
          timelineData,
          "Timeline data retrieved successfully"
        )
      );
    } catch (error) {
      Logger.error("Error fetching timeline data:", error);
      throw error;
    }
  };

  public getDocumentDistribution = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const distribution = await KYC.aggregate([
        {
          $group: {
            _id: "$idDocumentType",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            type: "$_id",
            count: 1,
          },
        },
      ]);

      res.json(
        ResponseFormatter.success(
          distribution,
          "Document distribution retrieved successfully"
        )
      );
    } catch (error) {
      Logger.error("Error fetching document distribution:", error);
      throw error;
    }
  };

  public getGeographicalDistribution = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const distribution = await KYC.aggregate([
        {
          $group: {
            _id: "$address.country",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            country: "$_id",
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]);

      res.json(
        ResponseFormatter.success(
          distribution,
          "Geographical distribution retrieved successfully"
        )
      );
    } catch (error) {
      Logger.error("Error fetching geographical distribution:", error);
      throw error;
    }
  };

  public getProcessingTimeAnalytics = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    try {
      const processingTimeData = await KYC.aggregate([
        {
          $match: {
            submissionDate: { $gte: startDate, $lte: endDate },
            reviewDate: { $exists: true },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$submissionDate" },
            },
            averageTime: {
              $avg: {
                $divide: [
                  { $subtract: ["$reviewDate", "$submissionDate"] },
                  3600000,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            averageTime: 1,
          },
        },
        { $sort: { date: 1 } },
      ]);

      res.json(
        ResponseFormatter.success(
          processingTimeData,
          "Processing time analytics retrieved successfully"
        )
      );
    } catch (error) {
      Logger.error("Error fetching processing time analytics:", error);
      throw error;
    }
  };
}
