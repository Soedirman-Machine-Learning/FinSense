import { useCart } from '../../../hooks/useCart';
import { useAuth } from '../../../context/AuthContext';
import { createTransaction } from '../../../services/transactionService';
import { updateStock, getProductById } from '../../../services/productService';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function CartPos() {
  const { cart, removeItem, updateItem, emptyCart } = useCart();
  const { user } = useAuth();
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  const generateStrukPDF = (transactionData) => {
    const { transactionId, date, items, subtotal, payment, change, cashier } =
      transactionData;
    const doc = new jsPDF({ unit: 'mm', format: [58, 200] });
    const leftMargin = 2;
    const maxWidth = 54;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('FINSENSE', leftMargin + maxWidth / 2, 5, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Kasir : ${cashier}`, leftMargin, 10);
    doc.text(`Tanggal: ${date}`, leftMargin, 15);
    doc.text(`ID Trx : ${transactionId}`, leftMargin, 20);
    doc.line(leftMargin, 23, leftMargin + maxWidth, 23);

    const tableHeaders = [['Item', 'Qty', 'Harga', 'Total']];
    const tableRows = items.map((item) => [
      item.name,
      item.qty,
      `Rp${item.price.toLocaleString()}`,
      `Rp${(item.price * item.qty).toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: 25,
      head: tableHeaders,
      body: tableRows,
      theme: 'plain',
      styles: { fontSize: 6, cellPadding: 1, halign: 'left' },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6,
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 6, halign: 'center' },
        2: { cellWidth: 12, halign: 'right' },
        3: { cellWidth: 14, halign: 'right' },
      },
      margin: { left: leftMargin, right: 2 },
      tableWidth: maxWidth,
    });

    let finalY = doc.lastAutoTable.finalY + 2;
    doc.line(leftMargin, finalY, leftMargin + maxWidth, finalY);
    finalY += 3;
    doc.setFontSize(7);
    doc.text(
      `Subtotal   : Rp${subtotal.toLocaleString()}`,
      leftMargin + maxWidth - 2,
      finalY,
      { align: 'right' },
    );
    finalY += 5;
    doc.text(
      `Dibayar    : Rp${payment.toLocaleString()}`,
      leftMargin + maxWidth - 2,
      finalY,
      { align: 'right' },
    );
    finalY += 5;
    doc.text(
      `Kembalian  : Rp${change.toLocaleString()}`,
      leftMargin + maxWidth - 2,
      finalY,
      { align: 'right' },
    );
    finalY += 5;
    doc.line(leftMargin, finalY, leftMargin + maxWidth, finalY);
    finalY += 3;
    doc.setFont('helvetica', 'italic');
    doc.text('Terima kasih!', leftMargin + maxWidth / 2, finalY, {
      align: 'center',
    });
    finalY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('FinSense POS', leftMargin + maxWidth / 2, finalY, {
      align: 'center',
    });
    doc.save(`struk_${transactionId}.pdf`);
  };

  const onDeleteHandler = (item) => {
    Swal.fire({
      title: 'Hapus Item?',
      text: `Yakin ingin menghapus ${item.name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    }).then((result) => {
      if (result.isConfirmed) removeItem(item.id);
    });
  };

  const onCheckout = async () => {
    if (cart.length === 0) {
      Swal.fire('Keranjang kosong', 'Tambahkan produk terlebih dahulu', 'info');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Konfirmasi Transaksi',
      text: `Total Rp ${subtotal.toLocaleString()}. Lanjutkan ke pembayaran?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, lanjut',
    });
    if (!confirm.isConfirmed) return;

    const { value: paymentAmount } = await Swal.fire({
      title: 'Jumlah Bayar',
      input: 'number',
      inputLabel: `Total belanja: Rp ${subtotal.toLocaleString()}`,
      inputPlaceholder: 'Masukkan jumlah uang customer',
      inputAttributes: { min: subtotal, step: '1' },
      showCancelButton: true,
      confirmButtonText: 'Hitung Kembalian',
      preConfirm: (amount) => {
        const num = Number(amount);
        if (isNaN(num) || num < subtotal) {
          Swal.showValidationMessage(
            `Jumlah bayar minimal Rp ${subtotal.toLocaleString()}`,
          );
          return false;
        }
        return num;
      },
    });
    if (!paymentAmount) return;
    const change = paymentAmount - subtotal;

    const finalConfirm = await Swal.fire({
      title: 'Detail Pembayaran',
      html: `
        <div style="text-align: left">
          <p><strong>Subtotal:</strong> Rp ${subtotal.toLocaleString()}</p>
          <p><strong>Dibayar:</strong> Rp ${paymentAmount.toLocaleString()}</p>
          <p><strong>Kembalian:</strong> Rp ${change.toLocaleString()}</p>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Cetak Struk & Proses',
      cancelButtonText: 'Batal',
    });
    if (!finalConfirm.isConfirmed) return;

    try {
      // Check stock
      for (let item of cart) {
        const product = await getProductById(item.id);
        const currentStock = product.data?.stock ?? product.stock;
        if (currentStock < item.qty) {
          await Swal.fire({
            title: 'Stok tidak mencukupi',
            html: `${item.name}<br/>Stok tersedia: ${currentStock}<br/>Diminta: ${item.qty}`,
            icon: 'error',
          });
          return;
        }
      }

      const items = cart.map((item) => ({
        item_name: item.name,
        quantity: item.qty,
        unit: 'pcs',
        unit_price: item.price,
        product_id: item.id,
      }));

      const transactionPayload = {
        category_id: 1,
        type: 'income',
        amount: subtotal,
        description: `Penjualan POS - ${cart.length} item`,
        transaction_date: new Date().toISOString(),
        source: 'ai',
        items: items,
      };

      const response = await createTransaction(transactionPayload);
      const transactionId = response.data?.id || response.id || 'Unknown';

      for (let item of cart) {
        await updateStock(item.id, {
          quantity: item.qty,
          type: 'out',
          note: 'Penjualan POS',
        });
      }

      // Ambil nama kasir dari context
      const cashierName = user?.full_name || 'Kasir';

      generateStrukPDF({
        transactionId,
        date: new Date().toLocaleString('id-ID'),
        items: cart,
        subtotal,
        payment: paymentAmount,
        change,
        cashier: cashierName,
      });

      Swal.fire(
        'Sukses',
        'Transaksi berhasil diproses & struk diunduh',
        'success',
      );
      emptyCart();
    } catch (err) {
      console.error(err);
      Swal.fire(
        'Gagal',
        err.response?.data?.error || 'Terjadi kesalahan',
        'error',
      );
    }
  };

  return (
    <div className='flex flex-col p-2 h-full'>
      <h1 className='font-semibold text-xl text-sky-950 mb-2'>Keranjang</h1>
      <div className='flex flex-col gap-2 max-h-96 overflow-y-auto flex-1 mt-2'>
        {cart.length === 0 ? (
          <p className='text-gray-500 text-center py-8'>Keranjang kosong</p>
        ) : (
          cart.map((item) => (
            <div key={item.id} className='border-b pb-2'>
              <div className='flex justify-between font-semibold'>
                {item.name}
              </div>
              <div className='flex flex-wrap justify-between items-center gap-2 text-gray-500'>
                <div className='flex items-center gap-4 mt-2'>
                  <span>Rp {item.price.toLocaleString()}</span>
                  <input
                    type='number'
                    min='1'
                    value={item.qty}
                    onChange={(e) =>
                      updateItem(item.id, parseInt(e.target.value) || 1)
                    }
                    className='w-16 p-1 border rounded'
                  />
                </div>
                <div className='flex gap-2'>
                  <span className='font-bold text-sky-950'>
                    Rp {(item.price * item.qty).toLocaleString()}
                  </span>
                  <button
                    onClick={() => onDeleteHandler(item)}
                    className='text-red-800 cursor-pointer'
                  >
                    X
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className='mt-auto pt-2 border-t'>
        <div className='flex justify-between'>
          <span className='text-gray-500'>Subtotal</span>
          <span className='font-bold text-lg'>
            Rp {subtotal.toLocaleString()}
          </span>
        </div>
        <button
          onClick={onCheckout}
          className='w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg mt-2'
        >
          Konfirmasi
        </button>
      </div>
    </div>
  );
}

export default CartPos;
