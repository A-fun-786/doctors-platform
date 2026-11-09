package com.docspace.template.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.docspace.template.R
import com.docspace.template.ui.theme.*

@Composable
fun MedicineDeliveryCard(
    modifier: Modifier = Modifier
) {
    DocSpaceCardScaffold(
        title = stringResource(R.string.title_clinic_pharmacy),
        badgeText = stringResource(R.string.badge_prescriptions),
        icon = Icons.Default.Medication,
        iconContentDescription = "Pharmacy",
        gradientColors = listOf(Emerald600, Color(0xFF047857)),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = stringResource(R.string.desc_clinic_pharmacy),
                style = MaterialTheme.typography.bodyMedium,
                color = Slate600,
                lineHeight = 20.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            FilledTonalButton(
                onClick = { /* Demo trigger */ },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = Emerald50,
                    contentColor = Emerald700
                )
            ) {
                Text(
                    text = stringResource(R.string.btn_order_medicines),
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}
