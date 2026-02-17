/**
 * Clients Controller
 */

const { sql } = require('../db');
const clientsSchema = require('../models/clients.schema');

class ClientsController {
    /**
     * Get all clients
     */
    async getAllClients(req, res) {
        try {
            const clients = await sql`
                SELECT * FROM clients ORDER BY created_at DESC
            `;
            res.json({
                success: true,
                data: clients.map(c => clientsSchema.sanitize(c))
            });
        } catch (error) {
            console.error('Get all clients error:', error);
            res.status(500).json({ error: 'Failed to retrieve clients' });
        }
    }

    /**
     * Get client by ID
     */
    async getClientById(req, res) {
        try {
            const { id } = req.params;
            const clients = await sql`
                SELECT * FROM clients WHERE id = ${id}
            `;

            if (clients.length === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.json({
                success: true,
                data: clientsSchema.sanitize(clients[0])
            });
        } catch (error) {
            console.error('Get client error:', error);
            res.status(500).json({ error: 'Failed to retrieve client' });
        }
    }

    /**
     * Create new client
     */
    async createClient(req, res) {
        try {
            const { name, email, phone, address, notes } = req.body;

            // Validate
            clientsSchema.validate.name(name);
            if (email) clientsSchema.validate.email(email);
            if (phone) clientsSchema.validate.phone(phone);

            const result = await sql`
                INSERT INTO clients (name, email, phone, address, notes)
                VALUES (${name}, ${email || null}, ${phone || null}, ${address || null}, ${notes || null})
                RETURNING *
            `;

            res.status(201).json({
                success: true,
                message: 'Client created successfully',
                data: clientsSchema.sanitize(result[0])
            });
        } catch (error) {
            console.error('Create client error:', error);
            if (error.message.includes('required') || error.message.includes('format')) {
                return res.status(400).json({ error: error.message });
            }
            if (error.message.includes('unique constraint')) {
                return res.status(409).json({ error: 'Client with this email already exists' });
            }
            res.status(500).json({ error: 'Failed to create client' });
        }
    }

    /**
     * Update client
     */
    async updateClient(req, res) {
        try {
            const { id } = req.params;
            const { name, email, phone, address, notes } = req.body;

            // Validate
            if (name) clientsSchema.validate.name(name);
            if (email) clientsSchema.validate.email(email);
            if (phone) clientsSchema.validate.phone(phone);

            const result = await sql`
                UPDATE clients
                SET 
                    name = COALESCE(${name}, name),
                    email = COALESCE(${email}, email),
                    phone = COALESCE(${phone}, phone),
                    address = COALESCE(${address}, address),
                    notes = COALESCE(${notes}, notes),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING *
            `;

            if (result.length === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.json({
                success: true,
                message: 'Client updated successfully',
                data: clientsSchema.sanitize(result[0])
            });
        } catch (error) {
            console.error('Update client error:', error);
            if (error.message.includes('format') || error.message.includes('characters')) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to update client' });
        }
    }

    /**
     * Delete client
     */
    async deleteClient(req, res) {
        try {
            const { id } = req.params;
            const result = await sql`
                DELETE FROM clients WHERE id = ${id} RETURNING id
            `;

            if (result.length === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.json({
                success: true,
                message: 'Client deleted successfully'
            });
        } catch (error) {
            console.error('Delete client error:', error);
            res.status(500).json({ error: 'Failed to delete client' });
        }
    }
}

module.exports = new ClientsController();
