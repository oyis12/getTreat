import Service from "../models/services.model.js";

const sanitizeService = (service) => ({
  id: service._id?.toString?.() || service.id,
  name: service.name,
  slug: service.slug,
  description: service.description,
  category: service.category,
  access_type: service.access_type,
  active: service.active,
  sort_order: service.sort_order,
  plans: service.plans ?? [],
  created_at: service.createdAt,
  modified_at: service.modifiedAt,
});

export const getActiveServices = async ({ category = null } = {}) => {
  const filter = { active: true };

  if (category) {
    filter.category = category;
  }

  const services = await Service.find(filter)
    .sort({ category: 1, sort_order: 1, name: 1 })
    .lean();

  return services.map(sanitizeService);
};

export default {
  getActiveServices,
};
