import { render, screen, userEvent } from '@testing-library/react-native';

import { TransactionForm } from '../TransactionForm';

describe('<TransactionForm />', () => {
  it('shows field errors and does not submit when required fields are empty', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<TransactionForm mode="create" onSubmit={onSubmit} />);

    await user.press(screen.getByRole('button', { name: 'Adicionar transação' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Indica uma descrição.')).toBeOnTheScreen();
    expect(screen.getByText('Indica um valor.')).toBeOnTheScreen();
  });

  it('rejects invalid amounts and impossible dates', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<TransactionForm mode="create" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Descrição'), 'Café');
    await user.type(screen.getByLabelText('Valor (€)'), '-3');
    await user.clear(screen.getByLabelText('Data'));
    await user.type(screen.getByLabelText('Data'), '2026-02-30');
    await user.press(screen.getByRole('button', { name: 'Adicionar transação' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Valor inválido/)).toBeOnTheScreen();
    expect(screen.getByText(/Data inválida/)).toBeOnTheScreen();
  });

  it('submits a parsed expense by default, accepting a comma as decimal separator', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<TransactionForm mode="create" onSubmit={onSubmit} />);

    expect(screen.getByRole('radio', { name: 'Despesa' })).toBeChecked();

    await user.type(screen.getByLabelText('Descrição'), '  Supermercado ');
    await user.type(screen.getByLabelText('Valor (€)'), '23,40');
    await user.clear(screen.getByLabelText('Data'));
    await user.type(screen.getByLabelText('Data'), '2026-11-12');
    await user.type(screen.getByLabelText('Categoria (opcional)'), 'Casa');
    await user.press(screen.getByRole('button', { name: 'Adicionar transação' }));

    expect(onSubmit).toHaveBeenCalledWith({
      type: 'expense',
      description: 'Supermercado',
      amount: 23.4,
      date: '2026-11-12',
      category: 'Casa',
    });
  });

  it('lets the user switch to income and sends a null category when left empty', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<TransactionForm mode="create" onSubmit={onSubmit} />);

    await user.press(screen.getByRole('radio', { name: 'Receita' }));
    expect(screen.getByRole('radio', { name: 'Receita' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Despesa' })).not.toBeChecked();

    await user.type(screen.getByLabelText('Descrição'), 'Salário');
    await user.type(screen.getByLabelText('Valor (€)'), '1200');
    await user.press(screen.getByRole('button', { name: 'Adicionar transação' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'income', amount: 1200, category: null }),
    );
  });

  it('pre-fills values in edit mode and locks the transaction type', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(
      <TransactionForm
        mode="edit"
        onSubmit={onSubmit}
        initialValues={{
          type: 'income',
          description: 'Salário',
          amount: '1200,5',
          date: '2026-11-01',
          category: '',
        }}
      />,
    );

    expect(screen.getByLabelText('Descrição')).toHaveDisplayValue('Salário');
    expect(screen.getByRole('radio', { name: 'Despesa' })).toBeDisabled();
    expect(screen.getByText('O tipo não pode ser alterado depois de criado.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Guardar alterações' }));

    expect(onSubmit).toHaveBeenCalledWith({
      type: 'income',
      description: 'Salário',
      amount: 1200.5,
      date: '2026-11-01',
      category: null,
    });
  });

  it('marks the submit button as busy while saving', async () => {
    await render(<TransactionForm mode="create" onSubmit={jest.fn()} submitting />);

    const button = screen.getByRole('button', { name: 'Adicionar transação' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });
});
