import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Ticket } from './dto/ticket.interface.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';

@Injectable()
export class TicketsService {
  private readonly tickets: Ticket[] = [
    {
      id: 1,
      subject: 'Ticket 1',
      description: 'Description 1',
      priority: 'low',
      status: 'open',
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      subject: 'Ticket 2',
      description: 'Description 2',
      priority: 'high',
      status: 'open',
      createdAt: new Date().toISOString(),
    },
    {
      id: 3,
      subject: 'Ticket 3',
      description: 'Description 3',
      priority: 'high',
      status: 'closed',
      createdAt: new Date().toISOString(),
    },
  ];
  private nextId = 4;

  findAll(status: Ticket['status'], priority: Ticket['priority']) {
    let tickets = this.tickets;
    if (status) {
      tickets = tickets.filter((ticket) => ticket.status === status);
    }
    if (priority) {
      tickets = tickets.filter((ticket) => ticket.priority === priority);
    }
    return tickets;
  }

  findOne(id: number) {
    const ticket = this.tickets.find((ticket) => ticket.id === id);
    if (!ticket) {
      throw new NotFoundException(`Ticket with id ${id} not found`);
    }
    return ticket;
  }

  create(ticket: CreateTicketDto) {
    const newTicket: Ticket = {
      id: this.nextId++,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.tickets.push(newTicket);
    return newTicket;
  }

  update(id: number, updateTicketDto: UpdateTicketDto) {
    const ticket = this.findOne(id);
    if (ticket.status === 'closed') {
      throw new BadRequestException(
        `Cannot update this ticket is already closed,  ID: ${id} subject: ${ticket.subject}`,
      );
    }
    Object.assign(ticket, updateTicketDto);
    return ticket;
  }

  closeTicket(id: number) {
    const ticket = this.findOne(id);
    if (ticket.status === 'closed') {
      throw new BadRequestException(
        `Cannot close this ticket is already closed,  ID: ${id} subject: ${ticket.subject}`,
      );
    }
    ticket.status = 'closed';

    return {
      message: `Ticket ${id} closed successfully`,
      ticket,
    };
  }
}
