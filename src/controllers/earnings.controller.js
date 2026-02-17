// src/controllers/earnings.controller.js
const db = require('../models');
const { Op } = require('sequelize');

class EarningsController {
  // Get agent earnings dashboard data
  getAgentEarnings = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { period = 'month' } = req.query; // 'week', 'month', 'year'

      console.log(`💰 Fetching earnings for agent: ${agentId}, period: ${period}`);

      // Calculate date ranges based on period
      const now = new Date();
      let currentPeriodStart, lastPeriodStart, periodEnd;

      switch(period) {
        case 'week':
          currentPeriodStart = new Date(now.setDate(now.getDate() - now.getDay()));
          lastPeriodStart = new Date(currentPeriodStart);
          lastPeriodStart.setDate(lastPeriodStart.getDate() - 7);
          periodEnd = new Date();
          break;
        case 'month':
          currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          lastPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'year':
          currentPeriodStart = new Date(now.getFullYear(), 0, 1);
          lastPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
          periodEnd = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          lastPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      // Get all completed orders (delivered) for the agent
      const completedOrders = await db.Order.findAll({
        where: {
          agent_id: agentId,
          status: 'delivered',
          payment_status: 'paid'
        },
        include: [
          {
            model: db.User,
            as: 'customer',
            attributes: ['id', 'full_name', 'phone_number']
          },
          {
            model: db.AgentGasListing,
            as: 'listing',
            attributes: ['id', 'size'],
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['id', 'name', 'logo_url']
            }]
          }
        ],
        order: [['created_at', 'DESC']]
      });

      // Calculate total earnings
      const totalEarnings = completedOrders.reduce((sum, order) => {
        return sum + parseFloat(order.grand_total || 0);
      }, 0);

      // Get wallet balance if wallets table exists
      let walletBalance = 0;
      try {
        const wallet = await db.Wallet.findOne({
          where: { user_id: agentId }
        });
        walletBalance = wallet ? parseFloat(wallet.balance) : totalEarnings;
      } catch (error) {
        console.log('Wallet table not found, using order-based balance');
        walletBalance = totalEarnings;
      }

      // Calculate pending withdrawal (orders that are confirmed/processing but not delivered)
      const pendingOrders = await db.Order.findAll({
        where: {
          agent_id: agentId,
          status: {
            [Op.in]: ['confirmed', 'processing', 'dispatched']
          },
          payment_status: 'paid'
        }
      });

      const pendingWithdrawal = pendingOrders.reduce((sum, order) => {
        return sum + parseFloat(order.grand_total || 0);
      }, 0);

      // Calculate this period's earnings
      const thisPeriodOrders = completedOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= currentPeriodStart && orderDate <= periodEnd;
      });

      const thisPeriodEarnings = thisPeriodOrders.reduce((sum, order) => {
        return sum + parseFloat(order.grand_total || 0);
      }, 0);

      // Calculate last period's earnings
      const lastPeriodOrders = completedOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= lastPeriodStart && orderDate < currentPeriodStart;
      });

      const lastPeriodEarnings = lastPeriodOrders.reduce((sum, order) => {
        return sum + parseFloat(order.grand_total || 0);
      }, 0);

      // Format transactions for the recent transactions list
      const transactions = completedOrders.slice(0, 20).map(order => ({
        id: order.id,
        order_number: order.order_number,
        type: 'credit',
        amount: parseFloat(order.grand_total),
        description: `Order #${order.order_number} - ${order.listing?.brand?.name || 'Gas'} ${order.listing?.size || ''}`,
        date: order.created_at,
        status: 'completed',
        customer_name: order.customer?.full_name || 'Customer',
        payment_method: order.payment_method
      }));

      // Add pending transactions
      const pendingTransactions = pendingOrders.slice(0, 5).map(order => ({
        id: order.id,
        order_number: order.order_number,
        type: 'credit',
        amount: parseFloat(order.grand_total),
        description: `Order #${order.order_number} - ${order.listing?.brand?.name || 'Gas'} ${order.listing?.size || ''}`,
        date: order.created_at,
        status: 'pending',
        customer_name: order.customer?.full_name || 'Customer',
        payment_method: order.payment_method
      }));

      const allTransactions = [...transactions, ...pendingTransactions].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      ).slice(0, 20);

      // Calculate stats
      const stats = {
        totalOrders: completedOrders.length,
        pendingOrders: pendingOrders.length,
        averageOrderValue: completedOrders.length > 0 ? totalEarnings / completedOrders.length : 0
      };

      console.log(`✅ Earnings calculated: Total: KES ${totalEarnings}, Available: KES ${walletBalance}`);

      res.json({
        success: true,
        data: {
          totalEarnings,
          availableBalance: walletBalance,
          pendingWithdrawal,
          thisMonth: thisPeriodEarnings,
          lastMonth: lastPeriodEarnings,
          transactions: allTransactions,
          stats
        }
      });

    } catch (error) {
      console.error('❌ Error fetching agent earnings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch earnings data',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Get earnings analytics
  getEarningsAnalytics = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { months = 6 } = req.query;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - parseInt(months));

      const orders = await db.Order.findAll({
        where: {
          agent_id: agentId,
          status: 'delivered',
          payment_status: 'paid',
          created_at: {
            [Op.between]: [startDate, endDate]
          }
        },
        order: [['created_at', 'ASC']]
      });

      // Group by month
      const monthlyData = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);

        const monthOrders = orders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= monthStart && orderDate <= monthEnd;
        });

        const total = monthOrders.reduce((sum, order) => sum + parseFloat(order.grand_total), 0);

        monthlyData.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          earnings: total,
          orders: monthOrders.length
        });

        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      res.json({
        success: true,
        data: {
          monthly: monthlyData,
          summary: {
            totalEarnings: orders.reduce((sum, order) => sum + parseFloat(order.grand_total), 0),
            totalOrders: orders.length
          }
        }
      });

    } catch (error) {
      console.error('❌ Error fetching earnings analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch earnings analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Get daily earnings
  getDailyEarnings = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { date } = req.query;

      const targetDate = date ? new Date(date) : new Date();
      targetDate.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const orders = await db.Order.findAll({
        where: {
          agent_id: agentId,
          status: 'delivered',
          payment_status: 'paid',
          created_at: {
            [Op.between]: [targetDate, nextDate]
          }
        },
        include: [
          {
            model: db.User,
            as: 'customer',
            attributes: ['id', 'full_name']
          },
          {
            model: db.AgentGasListing,
            as: 'listing',
            attributes: ['id', 'size'],
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['name']
            }]
          }
        ]
      });

      const totalEarnings = orders.reduce((sum, order) => sum + parseFloat(order.grand_total), 0);
      const totalOrders = orders.length;

      // Group by hour
      const hourlyData = {};
      for (let i = 0; i < 24; i++) {
        hourlyData[i] = {
          hour: `${i}:00 - ${i+1}:00`,
          earnings: 0,
          orders: 0
        };
      }

      orders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourlyData[hour].earnings += parseFloat(order.grand_total);
        hourlyData[hour].orders += 1;
      });

      const hourlyBreakdown = Object.values(hourlyData).filter(h => h.orders > 0);

      res.json({
        success: true,
        data: {
          date: targetDate.toDateString(),
          totalEarnings,
          totalOrders,
          averageOrderValue: totalOrders > 0 ? totalEarnings / totalOrders : 0,
          hourlyBreakdown,
          orders: orders.map(order => ({
            id: order.id,
            order_number: order.order_number,
            time: order.created_at,
            customer: order.customer?.full_name || 'Customer',
            product: `${order.listing?.brand?.name || 'Gas'} ${order.listing?.size || ''}`,
            amount: parseFloat(order.grand_total)
          }))
        }
      });

    } catch (error) {
      console.error('❌ Error fetching daily earnings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch daily earnings',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Get monthly earnings
  getMonthlyEarnings = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { year, month } = req.query;

      const targetYear = year || new Date().getFullYear();
      const targetMonth = month || new Date().getMonth() + 1;

      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 0);

      const orders = await db.Order.findAll({
        where: {
          agent_id: agentId,
          status: 'delivered',
          payment_status: 'paid',
          created_at: {
            [Op.between]: [startDate, endDate]
          }
        },
        include: [
          {
            model: db.User,
            as: 'customer',
            attributes: ['id', 'full_name']
          },
          {
            model: db.AgentGasListing,
            as: 'listing',
            attributes: ['id', 'size'],
            include: [{
              model: db.GasBrand,
              as: 'brand',
              attributes: ['name']
            }]
          }
        ],
        order: [['created_at', 'ASC']]
      });

      const totalEarnings = orders.reduce((sum, order) => sum + parseFloat(order.grand_total), 0);
      const totalOrders = orders.length;

      // Group by day
      const dailyData = [];
      const daysInMonth = endDate.getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStart = new Date(targetYear, targetMonth - 1, day, 0, 0, 0, 0);
        const dayEnd = new Date(targetYear, targetMonth - 1, day, 23, 59, 59, 999);

        const dayOrders = orders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= dayStart && orderDate <= dayEnd;
        });

        const dayEarnings = dayOrders.reduce((sum, order) => sum + parseFloat(order.grand_total), 0);

        dailyData.push({
          day: day,
          day_name: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
          earnings: dayEarnings,
          orders: dayOrders.length
        });
      }

      const daysWithEarnings = dailyData.filter(day => day.earnings > 0).length;
      const averageDailyEarnings = daysWithEarnings > 0 ? totalEarnings / daysWithEarnings : 0;
      const peakDay = dailyData.reduce((max, day) => day.earnings > max.earnings ? day : max, { earnings: 0, day: 0 });

      res.json({
        success: true,
        data: {
          month: startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          totalEarnings,
          totalOrders,
          averageOrderValue: totalOrders > 0 ? totalEarnings / totalOrders : 0,
          averageDailyEarnings,
          activeDays: daysWithEarnings,
          peakDay: {
            day: peakDay.day,
            day_name: peakDay.day_name,
            earnings: peakDay.earnings,
            orders: peakDay.orders
          },
          dailyBreakdown: dailyData.filter(day => day.earnings > 0),
          recentOrders: orders.slice(0, 10).map(order => ({
            id: order.id,
            order_number: order.order_number,
            date: order.created_at,
            customer: order.customer?.full_name || 'Customer',
            product: `${order.listing?.brand?.name || 'Gas'} ${order.listing?.size || ''}`,
            amount: parseFloat(order.grand_total)
          }))
        }
      });

    } catch (error) {
      console.error('❌ Error fetching monthly earnings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch monthly earnings',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // Get earnings by product
  getEarningsByProduct = async (req, res) => {
    try {
      const agentId = req.user.id;
      const { period = 'month' } = req.query;

      let startDate, endDate;
      const now = new Date();

      switch(period) {
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          endDate = new Date();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      const orders = await db.Order.findAll({
        where: {
          agent_id: agentId,
          status: 'delivered',
          payment_status: 'paid',
          created_at: {
            [Op.between]: [startDate, endDate]
          }
        },
        include: [{
          model: db.AgentGasListing,
          as: 'listing',
          attributes: ['id', 'size'],
          include: [{
            model: db.GasBrand,
            as: 'brand',
            attributes: ['id', 'name', 'logo_url']
          }]
        }]
      });

      // Group by product
      const productMap = new Map();

      orders.forEach(order => {
        if (!order.listing) return;
        
        const brandName = order.listing.brand?.name || 'Unknown';
        const size = order.listing.size || 'Unknown';
        const key = `${brandName}-${size}`;
        
        if (!productMap.has(key)) {
          productMap.set(key, {
            brand: brandName,
            size: size,
            logo_url: order.listing.brand?.logo_url,
            total_orders: 0,
            total_quantity: 0,
            total_revenue: 0
          });
        }
        
        const product = productMap.get(key);
        product.total_orders += 1;
        product.total_quantity += order.quantity;
        product.total_revenue += parseFloat(order.grand_total);
      });

      const products = Array.from(productMap.values()).map(p => ({
        ...p,
        average_price: p.total_quantity > 0 ? p.total_revenue / p.total_quantity : 0
      }));

      products.sort((a, b) => b.total_revenue - a.total_revenue);

      res.json({
        success: true,
        data: {
          period,
          startDate,
          endDate,
          totalRevenue: products.reduce((sum, p) => sum + p.total_revenue, 0),
          totalOrders: products.reduce((sum, p) => sum + p.total_orders, 0),
          products
        }
      });

    } catch (error) {
      console.error('❌ Error fetching earnings by product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch earnings by product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
}

module.exports = new EarningsController();