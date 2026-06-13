import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

function buildDateFilter(month: string | null, year: string | null) {
  if ((!month || month === "all") && (!year || year === "all")) {
    return undefined;
  }

  const currentYear = new Date().getFullYear();
  const filterYear = year && year !== "all" ? parseInt(year) : currentYear;

  if (month && month !== "all") {
    const filterMonth = parseInt(month);
    return {
      gte: new Date(filterYear, filterMonth - 1, 1),
      lt: new Date(filterYear, filterMonth, 1),
    };
  }

  return {
    gte: new Date(filterYear, 0, 1),
    lt: new Date(filterYear + 1, 0, 1),
  };
}

function calculateTotalExpenses(
  expenses: { amount: number; paidBy: string }[],
  paidByFilter: string | null,
) {
  return expenses.reduce((sum, exp) => {
    if (paidByFilter === "Noman" || paidByFilter === "Mujtaba") {
      if (exp.paidBy === "Shared") return sum + exp.amount / 2;
      return sum + exp.amount;
    }
    return sum + exp.amount;
  }, 0);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, amount, paidBy, createdAt } = body;

    if (!description || amount === undefined || !paidBy || !createdAt) {
      return NextResponse.json(
        { error: "Description, amount, paid by, and date are required" },
        { status: 400 },
      );
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 },
      );
    }

    const validPaidBy = ["Noman", "Mujtaba", "Shared"];
    if (!validPaidBy.includes(paidBy)) {
      return NextResponse.json(
        { error: "Paid by must be Noman, Mujtaba, or Shared" },
        { status: 400 },
      );
    }

    const expense = await prisma.expense.create({
      data: {
        description,
        amount: amountNum,
        paidBy,
        createdAt: new Date(createdAt),
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const paidBy = searchParams.get("paidBy");

    const whereClause: {
      createdAt?: { gte: Date; lt: Date };
      paidBy?: string | { in: string[] };
    } = {};

    const dateFilter = buildDateFilter(month, year);
    if (dateFilter) {
      whereClause.createdAt = dateFilter;
    }

    if (paidBy && paidBy !== "all") {
      whereClause.paidBy = { in: [paidBy, "Shared"] };
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    const totalExpenses = calculateTotalExpenses(expenses, paidBy);

    return NextResponse.json({
      expenses,
      totalExpenses,
      count: expenses.length,
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch expenses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
