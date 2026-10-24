import { RelationSelect } from '../../components/RelationSelect';

type Props = {
  id: string;
  label: string;
  catalog: string;
  value: string;
  onChange: (value: string, label?: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
};

/** Selector de catálogo de documentos; usa el mismo combobox con búsqueda que el resto de CxP. */
export function DocumentoCatalogPicker({ id, label, catalog, value, onChange, placeholder, required, error }: Props) {
  return <RelationSelect id={id} label={label} catalog={catalog} value={value} onChange={onChange}
    placeholder={placeholder} required={required} error={error} allowCreate={false} />;
}
