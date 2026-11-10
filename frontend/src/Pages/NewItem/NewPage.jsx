import React from 'react';
import NewItem from '../../Components/NewItem/NewItem';

function NewPage() {
  return (
    <div className="py-2 px-4">

      {/* Header */}
      <h1 className="p-2 text-gray-700 text-2xl font-bold">Tambah Item Baru</h1>

      <NewItem />
    </div>
  );
}

export default NewPage;