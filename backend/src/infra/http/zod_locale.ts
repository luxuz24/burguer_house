import { z } from 'zod';

// Configurado no bootstrap do app para que todos os schemas emitam mensagens padrão em português (pt-BR).
z.config(z.locales.ptBR());
