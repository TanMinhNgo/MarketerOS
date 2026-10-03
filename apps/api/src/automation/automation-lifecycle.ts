import type { Prisma } from '../generated/prisma/client';

export async function cancelQueued(
  tx: Prisma.TransactionClient,
  automationIds: string[],
  summary: string,
) {
  const runs = await tx.automationRun.findMany({
    where: { automationId: { in: automationIds }, status: 'queued' },
    select: { generationId: true },
  });
  await tx.automationRun.updateMany({
    where: { automationId: { in: automationIds }, status: 'queued' },
    data: { status: 'skipped', finishedAt: new Date(), summary },
  });
  await tx.generation.updateMany({
    where: {
      id: {
        in: runs.flatMap((run) => (run.generationId ? [run.generationId] : [])),
      },
      status: 'PENDING',
      kind: 'AUTOMATION',
    },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
      errorCode: 'AUTOMATION_PAUSED',
    },
  });
}

export async function pauseAutomations(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const items = await tx.automation.findMany({
    where: { project: { ownerId: userId } },
    select: { id: true },
  });
  await tx.automation.updateMany({
    where: { project: { ownerId: userId } },
    data: { enabled: false, nextRunAt: null },
  });
  await cancelQueued(
    tx,
    items.map((item) => item.id),
    'Tạm dừng: không còn quyền Max automation.',
  );
}
