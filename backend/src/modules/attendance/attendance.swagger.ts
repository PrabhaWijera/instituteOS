/**
 * @swagger
 * /attendance/sessions:
 *   post:
 *     summary: Start an attendance session (Teacher/Admin)
 *     tags: [Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classId]
 *             properties:
 *               classId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Session started with OTP code
 *       403:
 *         description: Not authorized
 *   get:
 *     summary: List attendance sessions (Teacher/Admin)
 *     tags: [Attendance]
 *     responses:
 *       200:
 *         description: List of attendance sessions
 *
 * /attendance/sessions/{id}/end:
 *   patch:
 *     summary: End an attendance session
 *     tags: [Attendance]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session ended
 *       404:
 *         description: Session not found
 *
 * /attendance/verify-otp:
 *   post:
 *     summary: Verify OTP to mark attendance (Student)
 *     tags: [Attendance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classId, otpCode]
 *             properties:
 *               classId:
 *                 type: string
 *                 format: uuid
 *               otpCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Attendance marked
 *       400:
 *         description: Invalid or expired OTP
 *
 * /attendance/history/me:
 *   get:
 *     summary: Get student's own attendance history
 *     tags: [Attendance]
 *     responses:
 *       200:
 *         description: Attendance records
 */
