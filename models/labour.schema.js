/**
 * Labour Schema
 */

const labourSchema = {
  tableName: 'labour',
  attendanceTable: 'attendance',
  advancesTable: 'advances',

  getCreateTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS labour (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(100),
        daily_wage DECIMAL(10, 2) NOT NULL,
        phone VARCHAR(20),
        joining_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(20) DEFAULT 'active', -- active, inactive, left
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  },

  getAttendanceTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        labour_id INTEGER REFERENCES labour(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(20) CHECK (status IN ('present', 'absent', 'late', 'half-day')),
        check_in TIME,
        check_out TIME,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(labour_id, date)
      );
    `;
  },

  getAdvancesTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS advances (
        id SERIAL PRIMARY KEY,
        labour_id INTEGER REFERENCES labour(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        type VARCHAR(20) CHECK (type IN ('advance', 'salary_payment', 'bonus')),
        amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50), -- cash, bank transfer, etc.
        reference_id VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  },

  validate: {
    labour: (data) => {
      if (!data.name) throw new Error('Labour name is required');
      if (!data.daily_wage || data.daily_wage <= 0) throw new Error('Valid daily wage is required');
      return true;
    },
    attendance: (data) => {
      if (!data.labour_id) throw new Error('Labour ID is required');
      if (!data.status) throw new Error('Attendance status is required');
      return true;
    },
    advance: (data) => {
      if (!data.labour_id) throw new Error('Labour ID is required');
      if (!data.amount || data.amount <= 0) throw new Error('Valid amount is required');
      if (!data.type) throw new Error('Transaction type is required');
      return true;
    }
  },

  sanitize: (item) => {
    if (!item) return null;
    return {
      ...item,
      daily_wage: item.daily_wage ? Number(item.daily_wage) : undefined,
      amount: item.amount ? Number(item.amount) : undefined,
      total_earned: item.total_earned ? Number(item.total_earned) : 0,
      total_advances: item.total_advances ? Number(item.total_advances) : 0,
      balance: item.balance ? Number(item.balance) : 0
    };
  }
};

module.exports = labourSchema;
