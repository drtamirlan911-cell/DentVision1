import * as api from '@/utils/api'

export class ApiClient {
  // Auth
  async login(loginStr: string, password: string) { return api.login(loginStr, password) }
  async register(data: any) { return api.register(data) }
  async getMe() { return api.getMe() }
  async forgotPassword(login: string) { return api.forgotPassword(login) }
  async resetPassword(token: string, newPassword: string) { return api.resetPassword(token, newPassword) }

  // Workspaces (Membership)
  async getMyClinics() { return api.getMyClinics() }
  async switchClinic(clinicId: string | null) { return api.switchClinic(clinicId) }
  async createClinic(data: any) { return api.createClinic(data) }
  async joinClinic(data: { code?: string; clinicId?: string }) { return api.joinClinic(data) }
  async createInvitation(data: { clinicId: string; email?: string; role?: string; spec?: string }) { return api.createInvitation(data) }
  async getInvitation(code: string) { return api.getInvitation(code) }

  // Clinics
  async getClinics() { return api.getClinics() }
  async getClinic(clinicId: string) { return api.getClinic(clinicId) }

  // Patients
  async getPatients(clinicId: string) { return api.getPatients(clinicId) }
  async upsertPatient(data: any) { return api.upsertPatient(data) }
  async deletePatient(id: string) { return api.deletePatient(id) }

  // Appointments
  async getAppointments(clinicId: string) { return api.getAppointments(clinicId) }
  async upsertAppointment(data: any) { return api.upsertAppointment(data) }
  async deleteAppointment(id: string) { return api.deleteAppointment(id) }

  // Receipts / Billing
  async getReceipts(clinicId: string) { return api.getReceipts(clinicId) }
  async upsertReceipt(data: any) { return api.upsertReceipt(data) }
  async deleteReceipt(id: string) { return api.deleteReceipt(id) }

  // Lab Orders
  async getLabOrders(clinicId: string) { return api.getLabOrders(clinicId) }
  async upsertLabOrder(data: any) { return api.upsertLabOrder(data) }
  async deleteLabOrder(id: string) { return api.deleteLabOrder(id) }

  // Expenses
  async getExpenses(clinicId: string) { return api.getExpenses(clinicId) }
  async upsertExpense(data: any) { return api.upsertExpense(data) }
  async deleteExpense(id: string) { return api.deleteExpense(id) }

  // Inventory
  async getInventory(clinicId: string) { return api.getInventory(clinicId) }
  async upsertInventoryItem(data: any) { return api.upsertInventoryItem(data) }
  async deleteInventoryItem(id: string) { return api.deleteInventoryItem(id) }

  // Promotions
  async getPromotions(clinicId: string) { return api.getPromotions(clinicId) }
  async upsertPromotion(data: any) { return api.upsertPromotion(data) }
  async deletePromotion(id: string) { return api.deletePromotion(id) }

  // Bookings
  async getBookings(clinicId: string) { return api.getBookings(clinicId) }
  async upsertBooking(data: any) { return api.upsertBooking(data) }
  async deleteBooking(id: string) { return api.deleteBooking(id) }

  // Photos
  async uploadPhoto(data: any) { return api.uploadPhoto(data) }
  async deletePhoto(id: string) { return api.deletePhoto(id) }

  // Users / Subscriptions
  async upsertUser(data: any) { return api.upsertUser(data) }
  async upsertSubscription(data: any) { return api.upsertSubscription(data) }
  async deleteSubscription(id: string) { return api.deleteSubscription(id) }

  // Public Booking
  async getPublicClinic(clinicId: string) { return api.getPublicClinic(clinicId) }
  async submitBooking(data: any) { return api.submitBooking(data) }

  // Medical Cards
  async getMedicalCard(patientId: string) { return api.getMedicalCard(patientId) }
  async upsertMedicalCard(data: any) { return api.upsertMedicalCard(data) }

  // ICD-10
  async getICD10(search: string) { return api.getICD10(search) }

  // Visits
  async getVisits(clinicId: string, patientId: string) { return api.getVisits(clinicId, patientId) }
  async upsertVisit(data: any) { return api.upsertVisit(data) }

  // Documents
  async getDocuments(clinicId: string, patientId: string) { return api.getDocuments(clinicId, patientId) }
  async upsertDocument(data: any) { return api.upsertDocument(data) }
  async deleteDocument(id: string) { return api.deleteDocument(id) }

  // Audit
  async getAuditLog(clinicId: string, limit: number = 100) { return api.getAuditLog(clinicId, limit) }
  async createBackup(clinicId: string) { return api.createBackup(clinicId) }

  // Treatments
  async getTreatments(clinicId: string) { return api.getTreatments(clinicId) }
  async upsertTreatment(data: any) { return api.upsertTreatment(data) }

  // Waiting List
  async getWaitingList(clinicId: string) { return api.getWaitingList(clinicId) }

  // Shop
  async getShopCategories() { return api.getShopCategories() }
  async getShopProducts(params?: Record<string, string>) { return api.getShopProducts(params) }
  async getShopProduct(id: string) { return api.getShopProduct(id) }
  async getShopSuppliers() { return api.getShopSuppliers() }
  async createShopOrder(data: any) { return api.createShopOrder(data) }
  async getShopOrders(clinicId: string) { return api.getShopOrders(clinicId) }
  async createShopReview(data: any) { return api.createShopReview(data) }
  async toggleShopFavorite(data: any) { return api.toggleShopFavorite(data) }
  async getShopFavorites(clinicId: string) { return api.getShopFavorites(clinicId) }

  // School
  async getSchoolCourses(params?: Record<string, string>) { return api.getSchoolCourses(params) }
  async getSchoolCourse(id: string) { return api.getSchoolCourse(id) }
  async enrollCourse(data: any) { return api.enrollCourse(data) }
  async getEnrollments(userId: string) { return api.getEnrollments(userId) }
  async updateEnrollment(id: string, data: any) { return api.updateEnrollment(id, data) }
  async getSchoolClinicalCases(category: string) { return api.getSchoolClinicalCases(category) }
  async getSchoolLibrary(params?: Record<string, string>) { return api.getSchoolLibrary(params) }
  async getSchoolCertificates(userId: string) { return api.getSchoolCertificates(userId) }

  // Service Access
  async getServiceAccess(clinicId: string) { return api.getServiceAccess(clinicId) }
  async setServiceAccess(clinicId: string, service: string, enabled: boolean) { return api.setServiceAccess(clinicId, service, enabled) }
  async setServiceAccessBulk(clinicId: string, services: Record<string, boolean>) { return api.setServiceAccessBulk(clinicId, services) }
  async getPublicServiceAccess(clinicId: string) { return api.getPublicServiceAccess(clinicId) }

  // Notifications
  async getNotifications(opts?: { unread?: boolean; type?: string; limit?: number }) { return api.getNotifications(opts) }
  async getUnreadCount() { return api.getUnreadCount() }
  async createNotification(input: api.NotificationInput) { return api.createNotification(input) }
  async markNotificationRead(id: string) { return api.markNotificationRead(id) }
  async markAllNotificationsRead() { return api.markAllNotificationsRead() }

  // Shop content management (superadmin)
  async createShopCategory(data: any) { return api.createShopCategory(data) }
  async deleteShopCategory(id: string) { return api.deleteShopCategory(id) }
  async createShopSupplier(data: any) { return api.createShopSupplier(data) }
  async deleteShopSupplier(id: string) { return api.deleteShopSupplier(id) }
  async createShopProduct(data: any) { return api.createShopProduct(data) }
  async updateShopProduct(id: string, data: any) { return api.updateShopProduct(id, data) }
  async deleteShopProduct(id: string) { return api.deleteShopProduct(id) }

  // School content management (superadmin)
  async createSchoolCourse(data: any) { return api.createSchoolCourse(data) }
  async updateSchoolCourse(id: string, data: any) { return api.updateSchoolCourse(id, data) }
  async deleteSchoolCourse(id: string) { return api.deleteSchoolCourse(id) }
  async createSchoolClinicalCase(data: any) { return api.createSchoolClinicalCase(data) }
  async deleteSchoolClinicalCase(id: string) { return api.deleteSchoolClinicalCase(id) }
  async createSchoolLibraryItem(data: any) { return api.createSchoolLibraryItem(data) }
  async deleteSchoolLibraryItem(id: string) { return api.deleteSchoolLibraryItem(id) }

  // User Professional Profile
  async getMyProfile() { return api.getMyProfile() }
  async getPublicProfile(identifier: string) { return api.getPublicProfile(identifier) }
  async updateMyProfile(data: any) { return api.updateMyProfile(data) }
  async addSkill(data: any) { return api.addSkill(data) }
  async deleteSkill(id: string) { return api.deleteSkill(id) }
  async addCertificate(data: any) { return api.addCertificate(data) }
  async deleteCertificate(id: string) { return api.deleteCertificate(id) }
  async addAchievement(data: any) { return api.addAchievement(data) }
  async deleteAchievement(id: string) { return api.deleteAchievement(id) }
  async addPortfolioItem(data: any) { return api.addPortfolioItem(data) }
  async deletePortfolioItem(id: string) { return api.deletePortfolioItem(id) }
  async addCase(data: any) { return api.addCase(data) }
  async deleteCase(id: string) { return api.deleteCase(id) }

  // AI
  async aiChat(message: string, history?: Array<{ role: string; content: string }>) { return api.aiChat(message, history) }
  async aiProactive() { return api.aiProactive() }
  async aiAction(action: string, params?: Record<string, unknown>) { return api.aiAction(action, params) }
  async aiDigitalTwin() { return api.aiDigitalTwin() }
}

export const apiClient = new ApiClient()
