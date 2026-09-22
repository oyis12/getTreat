const DAYS_IN_PREGNANCY = 280;
const MAX_GESTATIONAL_DAYS = 280;

export const calculatePregnancyProgress = (lastMenstralDate, now = new Date()) => {
  if (!lastMenstralDate) {
    return {
      expected_delivery_date: null,
      current_trimester: 0,
      weeks_gone: 0,
      weeks_left: 0,
    };
  }

  const lmp = new Date(lastMenstralDate);
  const currentDate = new Date(now);

  if (Number.isNaN(lmp.getTime())) {
    throw new Error("Invalid last menstral date");
  }

  const expectedDeliveryDate = new Date(lmp);
  expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + DAYS_IN_PREGNANCY);

  const elapsedMilliseconds = currentDate.getTime() - lmp.getTime();
  const elapsedDays = Math.max(0, Math.floor(elapsedMilliseconds / 86400000));
  const cappedGestationalDays = Math.min(elapsedDays, MAX_GESTATIONAL_DAYS);
  const weeksGone = Math.floor(cappedGestationalDays / 7);
  const weeksLeft = Math.max(0, 40 - weeksGone);

  let currentTrimester = 0;

  if (elapsedDays >= 0 && elapsedDays < 14 * 7) {
    currentTrimester = 1;
  } else if (elapsedDays < 28 * 7) {
    currentTrimester = 2;
  } else {
    currentTrimester = 3;
  }

  return {
    expected_delivery_date: expectedDeliveryDate,
    current_trimester: currentTrimester,
    weeks_gone: weeksGone,
    weeks_left: weeksLeft,
  };
};
