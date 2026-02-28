/**
 * Labour Controller
 */

const { sql } = require('../db');
const labourSchema = require('../models/labour.schema');

class LabourController {
  /**
   * Get all labour with summary stats
   */
  async getAllLabour(req, res) {
    try {
      // Query to get labour details plus calculated stats
      // Balance = (Days Worked * Daily Wage) - Total Advances
      const records = await sql`
        WITH attendance_stats AS (
          SELECT labour_id, COUNT(*) as days_worked
          FROM attendance
          WHERE status IN ('present', 'late', 'half-day')
          GROUP BY labour_id
        ),
        advance_stats AS (
          SELECT labour_id, SUM(amount) as total_advances
          FROM advances
          WHERE type = 'advance'
          GROUP BY labour_id
        ),
        payment_stats AS (
          SELECT labour_id, SUM(amount) as total_payments
          FROM advances
          WHERE type = 'salary_payment'
          GROUP BY labour_id
        )
        SELECT 
          l.*,
          COALESCE(a.days_worked, 0) as days_worked,
          (COALESCE(a.days_worked, 0) * l.daily_wage) as total_earned,
          COALESCE(adv.total_advances, 0) as total_advances,
          COALESCE(pay.total_payments, 0) as total_payments,
          ((COALESCE(a.days_worked, 0) * l.daily_wage) - COALESCE(adv.total_advances, 0) - COALESCE(pay.total_payments, 0)) as balance
        FROM labour l
        LEFT JOIN attendance_stats a ON l.id = a.labour_id
        LEFT JOIN advance_stats adv ON l.id = adv.labour_id
        LEFT JOIN payment_stats pay ON l.id = pay.labour_id
        ORDER BY l.name ASC
      `;

      res.json({
        success: true,
        data: records.map(r => labourSchema.sanitize(r))
      });
    } catch (error) {
      console.error('Get all labour error:', error);
      res.status(500).json({ error: 'Failed to retrieve labour records' });
    }
  }

  /**
   * Get labour by ID with stats
   */
  async getLabourById(req, res) {
    try {
      const { id } = req.params;
      const records = await sql`
        WITH attendance_stats AS (
          SELECT labour_id, COUNT(*) as days_worked
          FROM attendance
          WHERE labour_id = ${id} AND status IN ('present', 'late', 'half-day')
          GROUP BY labour_id
        ),
        advance_stats AS (
          SELECT labour_id, SUM(amount) as total_advances
          FROM advances
          WHERE labour_id = ${id} AND type = 'advance'
          GROUP BY labour_id
        ),
        payment_stats AS (
          SELECT labour_id, SUM(amount) as total_payments
          FROM advances
          WHERE labour_id = ${id} AND type = 'salary_payment'
          GROUP BY labour_id
        )
        SELECT 
          l.*,
          COALESCE(a.days_worked, 0) as days_worked,
          (COALESCE(a.days_worked, 0) * l.daily_wage) as total_earned,
          COALESCE(adv.total_advances, 0) as total_advances,
          COALESCE(pay.total_payments, 0) as total_payments,
          ((COALESCE(a.days_worked, 0) * l.daily_wage) - COALESCE(adv.total_advances, 0) - COALESCE(pay.total_payments, 0)) as balance
        FROM labour l
        LEFT JOIN attendance_stats a ON l.id = a.labour_id
        LEFT JOIN advance_stats adv ON l.id = adv.labour_id
        LEFT JOIN payment_stats pay ON l.id = pay.labour_id
        WHERE l.id = ${id}
      `;

      if (records.length === 0) return res.status(404).json({ error: 'Labour not found' });

      res.json({
        success: true,
        data: labourSchema.sanitize(records[0])
      });
    } catch (error) {
      console.error('Get labour by ID error:', error);
      res.status(500).json({ error: 'Failed to retrieve labour record' });
    }
  }

  /**
   * Get attendance and transaction history for a worker
   */
  async getLabourHistory(req, res) {
    try {
      const { id } = req.params;
      
      const attendance = await sql`
        SELECT * FROM attendance 
        WHERE labour_id = ${id} 
        ORDER BY date DESC 
        LIMIT 50
      `;

      const transactions = await sql`
        SELECT * FROM advances 
        WHERE labour_id = ${id} 
        ORDER BY date DESC, created_at DESC 
        LIMIT 50
      `;

      res.json({
        success: true,
        data: {
          attendance,
          transactions: transactions.map(t => labourSchema.sanitize(t))
        }
      });
    } catch (error) {
      console.error('Get labour history error:', error);
      res.status(500).json({ error: 'Failed to retrieve history' });
    }
  }

  /**
   * Get labour stats for dashboard
   */
  async getLabourStats(req, res) {
    try {
      const stock = await sql`SELECT daily_wage FROM labour WHERE status = 'active'`;
      const attendance = await sql`
        SELECT date, 
               COUNT(CASE WHEN status = 'present' OR status = 'late' THEN 1 END) as present,
               COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent
        FROM attendance
        WHERE date >= now() - interval '7 days'
        GROUP BY date
        ORDER BY date ASC
      `;

      const monthlyExpense = await sql`
        SELECT TO_CHAR(date, 'Mon YYYY') as month, SUM(amount) as amount
        FROM advances
        WHERE type = 'salary_payment' OR type = 'advance'
        GROUP BY TO_CHAR(date, 'Mon YYYY')
        ORDER BY MIN(date) ASC
        LIMIT 6
      `;

      res.json({
        success: true,
        data: {
          totalLabour: stock.length,
          attendanceData: attendance.map(a => ({
            date: new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            present: Number(a.present),
            absent: Number(a.absent)
          })),
          monthlyExpenseData: monthlyExpense.map(m => ({
            month: m.month,
            amount: Number(m.amount)
          }))
        }
      });
    } catch (error) {
      console.error('Get labour stats error:', error);
      res.status(500).json({ error: 'Failed to retrieve stats' });
    }
  }

  /**
   * Create new labour profile
   */
  async createLabour(req, res) {
    try {
      const { name, role, daily_wage, phone } = req.body;
      labourSchema.validate.labour({ name, daily_wage });

      const records = await sql`
        INSERT INTO labour (name, role, daily_wage, phone)
        VALUES (${name}, ${role}, ${daily_wage}, ${phone})
        RETURNING *
      `;

      res.status(201).json({
        success: true,
        data: labourSchema.sanitize(records[0])
      });
    } catch (error) {
      console.error('Create labour error:', error);
      res.status(500).json({ error: error.message || 'Failed to create labour profile' });
    }
  }

  /**
   * Mark attendance
   */
  async markAttendance(req, res) {
    try {
      const { labour_id, date, status, check_in, check_out, notes } = req.body;
      labourSchema.validate.attendance({ labour_id, status });

      const records = await sql`
        INSERT INTO attendance (labour_id, date, status, check_in, check_out, notes)
        VALUES (${labour_id}, ${date}, ${status}, ${check_in || null}, ${check_out || null}, ${notes || null})
        ON CONFLICT (labour_id, date) 
        DO UPDATE SET 
          status = EXCLUDED.status,
          check_in = EXCLUDED.check_in,
          check_out = EXCLUDED.check_out,
          notes = EXCLUDED.notes
        RETURNING *
      `;

      res.json({
        success: true,
        data: records[0]
      });
    } catch (error) {
      console.error('Mark attendance error:', error);
      res.status(500).json({ error: error.message || 'Failed to mark attendance' });
    }
  }

  /**
   * Delete attendance
   */
  async deleteAttendance(req, res) {
    try {
      const { id } = req.params;
      await sql`
        DELETE FROM attendance
        WHERE id = ${id}
      `;

      res.json({
        success: true,
        message: 'Attendance record deleted'
      });
    } catch (error) {
      console.error('Delete attendance error:', error);
      res.status(500).json({ error: 'Failed to delete attendance record' });
    }
  }

  /**
   * Record advance/payment
   */
  async recordAdvance(req, res) {
    try {
      const { labour_id, date, type, amount, payment_method, reference_id, notes } = req.body;
      labourSchema.validate.advance({ labour_id, amount, type });

      const records = await sql`
        INSERT INTO advances (labour_id, date, type, amount, payment_method, reference_id, notes)
        VALUES (${labour_id}, ${date}, ${type}, ${amount}, ${payment_method}, ${reference_id}, ${notes || null})
        RETURNING *
      `;

      res.status(201).json({
        success: true,
        data: labourSchema.sanitize(records[0])
      });
    } catch (error) {
      console.error('Record advance error:', error);
      res.status(500).json({ error: error.message || 'Failed to record transaction' });
    }
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(req, res) {
    try {
      const records = await sql`
        SELECT a.*, l.name as labour_name
        FROM advances a
        JOIN labour l ON a.labour_id = l.id
        ORDER BY a.date DESC, a.created_at DESC
        LIMIT 20
      `;
      res.json({
        success: true,
        data: records.map(r => labourSchema.sanitize(r))
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ error: 'Failed to retrieve transactions' });
    }
  }
}

module.exports = new LabourController();
