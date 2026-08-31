import { Injectable, Dependencies } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Injectable()
@Dependencies(SupabaseService)
export class SupabaseDbService {
  constructor(supabaseService) {
    this.supabase = supabaseService;
  }

  getClient() {
    return this.supabase.getClient();
  }

  async findMany(table, options = {}) {
    /**
     * Finds multiple rows from a Supabase table.
     *
     * @param {string} table - The name of the table to query.
     * @param {Object} [options={}] - Optional query settings.
     * @param {string} [options.select='*'] - The columns to select.
     * @param {Object} [options.filters] - Key-value pairs used to filter rows.
     * @returns {Promise<Array>} The matching rows from the table.
     */

    //Get the client so we can make db calls
    const client = this.getClient();

    let query = client.from(table).select(options.select || '*');

    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data;
  }

  async findOne(table, options = {}) {
    const client = this.getClient();

    let query = client.from(table).select(options.select || '*');

    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return data[0];
  }

  async insert(table, payload) {
    const client = this.getClient();

    const { data, error } = await client.from(table).insert(payload).select();

    if (error) throw error;

    return data;
  }

  async update(table, payload, filters = {}) {
    const client = this.getClient();

    let query = client.from(table).update(payload);

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    const { data, error } = await query.select();

    if (error) {
      throw error;
    }

    return data;
  }

  async remove(table, filters = {}) {
    const client = this.getClient();

    let query = client.from(table).delete();

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    const { data, error } = await query.select();

    if (error) {
      throw error;
    }

    return data;
  }
}
