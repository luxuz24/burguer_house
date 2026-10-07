import { useEffect, useState, type FormEvent } from 'react';
import { api } from './lib/api';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
}

function App() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  // Estado para controlar os dados do formulário
  const [formData, setFormData] = useState({
    id: '',
    nome: '',
    unidade: 'Gramas',
    estoqueAtual: 0,
    estoqueMinimo: 0
  });

  // Extraímos a chamada para poder recarregar a lista depois de salvar ou apagar
  const carregarInsumos = () => {
    api.get('/insumos')
      .then(response => setInsumos(response.data))
      .catch(error => console.error("Erro ao carregar insumos:", error));
  };

  useEffect(() => {
    carregarInsumos();
  }, []);

  const lidarComSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      estoqueAtual: Number(formData.estoqueAtual),
      estoqueMinimo: Number(formData.estoqueMinimo),
      fatorPerda: 0 
    };

    try {
      const dadosInsumo = {
        nome: payload.nome,
        unidade: payload.unidade,
        estoqueAtual: payload.estoqueAtual,
        estoqueMinimo: payload.estoqueMinimo,
        fatorPerda: payload.fatorPerda
      };

      if (formData.id) {
        await api.put(`/insumos/${formData.id}`, dadosInsumo);
      } else {
        await api.post('/insumos', dadosInsumo);
      }
      
      setFormData({ id: '', nome: '', unidade: 'Gramas', estoqueAtual: 0, estoqueMinimo: 0 });
      setMostrarFormulario(false);
      carregarInsumos();
    } catch (error) {
      console.error("Erro ao guardar insumo:", error);
      alert("Ocorreu um erro ao guardar. Verifique a consola.");
    }
  };
  const editarInsumo = (insumo: Insumo) => {
    setFormData(insumo);
    setMostrarFormulario(true);
  };

  const apagarInsumo = async (id: string) => {
    if (window.confirm("Tem a certeza que deseja eliminar este insumo?")) {
      try {
        await api.delete(`/insumos/${id}`);
        carregarInsumos();
      } catch (error: unknown) {
        console.error("Erro ao apagar:", error);
        const axiosError = error as { response?: { data?: { message?: string } } };
        const mensagem = axiosError.response?.data?.message || "Erro ao apagar o insumo.";
        window.alert(`❌ Ops: ${mensagem}`);
      }
    }
  };
  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1> Estoque da Burguer House</h1>
        <button 
          onClick={() => {
            setFormData({ id: '', nome: '', unidade: 'Gramas', estoqueAtual: 0, estoqueMinimo: 0 });
            setMostrarFormulario(!mostrarFormulario);
          }}
          style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {mostrarFormulario ? 'Cancelar' : '+ Novo Insumo'}
        </button>
      </div>

      {mostrarFormulario && (
        <form onSubmit={lidarComSubmit} style={{ backgroundColor: '#f3f4f6', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3>{formData.id ? ' Editar Insumo' : ' Cadastrar Novo Insumo'}</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input 
              required
              placeholder="Nome do Insumo (ex: Maionese)"
              value={formData.nome}
              onChange={e => setFormData({...formData, nome: e.target.value})}
              style={{ flex: 1, padding: '8px' }}
            />
            <select 
              value={formData.unidade}
              onChange={e => setFormData({...formData, unidade: e.target.value})}
              style={{ padding: '8px' }}
            >
              <option value="Gramas">Gramas (g)</option>
              <option value="Unidades">Unidades (un)</option>
              <option value="Mililitros">Mililitros (ml)</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px' }}>Estoque Atual</label>
              <input 
                type="number" required min="0" step="0.01"
                value={formData.estoqueAtual}
                onChange={e => setFormData({...formData, estoqueAtual: Number(e.target.value)})}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px' }}>Estoque Mínimo</label>
              <input 
                type="number" required min="0" step="0.01"
                value={formData.estoqueMinimo}
                onChange={e => setFormData({...formData, estoqueMinimo: Number(e.target.value)})}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Guardar Insumo
          </button>
        </form>
      )}
      
      <table border={1} cellPadding={12} style={{ borderCollapse: 'collapse', width: '100%', textAlign: 'left' }}>
        <thead style={{ backgroundColor: '#f3f4f6' }}>
          <tr>
            <th>Insumo</th>
            <th>Unidade</th>
            <th>Estoque Atual</th>
            <th>Estoque Mínimo</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((insumo) => {
            const emAlerta = insumo.estoqueAtual <= insumo.estoqueMinimo;
            
            return (
              <tr key={insumo.id} style={{ backgroundColor: emAlerta ? '#fee2e2' : 'transparent' }}>
                <td style={{ fontWeight: 'bold' }}>{insumo.nome}</td>
                <td>{insumo.unidade}</td>
                <td>{insumo.estoqueAtual}</td>
                <td>{insumo.estoqueMinimo}</td>
                <td>
                  {emAlerta ? (
                    <span style={{ color: '#991b1b', fontWeight: 'bold' }}>⚠️ Comprar</span>
                  ) : (
                    <span style={{ color: '#166534' }}>✅ OK</span>
                  )}
                </td>
                <td>
                  <button onClick={() => editarInsumo(insumo)} style={{ marginRight: '8px', cursor: 'pointer', padding: '4px 8px' }}>Editar</button>
                  <button onClick={() => apagarInsumo(insumo.id)} style={{ cursor: 'pointer', color: '#991b1b', padding: '4px 8px' }}>Apagar</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;