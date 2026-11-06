-- AlterEnum: orders being packed, before they are dispatched
ALTER TYPE "OrderStatus" ADD VALUE 'PACKING' BEFORE 'DISPATCHED';
