"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePagination = parsePagination;
exports.paginatedResponse = paginatedResponse;
function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}
function paginatedResponse(data, total, params) {
    const totalPages = Math.ceil(total / params.limit);
    return {
        data,
        meta: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages,
            hasMore: params.page < totalPages,
        },
    };
}
